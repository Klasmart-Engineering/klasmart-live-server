import { convertSessionRecordToSession, fromRedisKeyValueArray } from "./utils";
import { redisStreamDeserialize, redisStreamSerialize } from "./utils";
import { RedisKeys } from "./redisKeys";
import Redis = require("ioredis")
import { WhiteboardService } from "./services/whiteboard/WhiteboardService";
import { Context } from "./main";
import WebSocket = require("ws");
import { PageEvent, Session } from "./types";

export class Model {
    public static async create() {
        const redis = new Redis({
            host: process.env.REDIS_HOST,
            port: Number(process.env.REDIS_PORT) || undefined,
            lazyConnect: true,
            password: process.env.REDIS_PASS || undefined
        });
        await redis.connect();
        console.log("🔴 Redis database connected");
        return new Model(redis);
    }

    private client: Redis.Redis
    private whiteboard: WhiteboardService

    private constructor(client: Redis.Redis) {
        this.client = client;
        this.whiteboard = new WhiteboardService(client);
    }

    public async getSession(roomId: string, sessionId: string): Promise<Session> {
        const sessionKey = RedisKeys.sessionData(roomId, sessionId);
        const sessionRecord = await this.client.hgetall(sessionKey);
        return convertSessionRecordToSession(sessionRecord);
    }

    public async getSfuAddress(roomId: string) {
        const sfu = RedisKeys.roomSfu(roomId);
        const address = await this.client.get(sfu.key);
        if (address) { return address; }

        const notify = RedisKeys.roomNotify(roomId);
        let lastNotifyIndex = "$";
        const endTime = Date.now() + 15 * 1000;
        while (Date.now() < endTime) {
            const responses = await this.client.xread(
                "BLOCK", 15,
                "STREAMS",
                notify.key,
                lastNotifyIndex,
            );
            if (!responses) { continue; }
            for (const [, response] of responses) {
                for (const [id, keyValues] of response) {
                    lastNotifyIndex = id;
                    const { sfuAddress } = redisStreamDeserialize<any>(keyValues as any);
                    if (sfuAddress) { return sfuAddress; }
                }
            }
        }
    }

    public async setSessionStreamId(roomId: string, sessionId: string| undefined, streamId: string) {
        if(!sessionId) { throw new Error("Can't setSessionStreamId without knowning the sessionId it was from"); }
        const sessionKey = RedisKeys.sessionData(roomId, sessionId);
        await this.client.pipeline()
            .hset(sessionKey, "id", sessionId)
            .hset(sessionKey, "streamId", streamId)
            .exec();
        const session = await this.getSession(roomId, sessionId);
        this.notifyRoom(roomId, { join: session });
    }

    public async setHost(roomId: string, hostId: string ) {
        if(!hostId) { throw new Error("Can't set the host without knowning the sessionId of the new host"); }
        for await (const session of this.getSessions(roomId)) {
            session.isHost = session.id === hostId;
            const sessionKey = RedisKeys.sessionData(roomId, hostId);
            await this.client.pipeline()
                .hset(sessionKey, "isHost", session.isHost.toString())
                .exec();
            this.notifyRoom(roomId, { join: session });
        }
    }

    public async showContent(roomId: string, type: string, contentId?: string) {
        const roomContent = RedisKeys.roomContent(roomId);
        const content = { type, contentId };
        await this.notifyRoom(roomId, { content });
        await this.client.set(roomContent.key, JSON.stringify(content));
        await this.client.expire(roomContent.key, roomContent.ttl);
    }

    public async postPageEvent(streamId: string, pageEvents: PageEvent[]) {
        const key = RedisKeys.streamEvents(streamId);
        const pipeline = this.client.pipeline();

        for (const { eventsSinceKeyframe, isKeyframe, eventData } of pageEvents) {
            pipeline.xadd(
                key,
                "MAXLEN", "~", (eventsSinceKeyframe + 1).toString(),
                "*",
                "i", eventsSinceKeyframe.toString(),
                "c", isKeyframe.toString(),
                "e", eventData
            );
        }
        pipeline.expire(key, 60);
        const result = await pipeline.exec();
        return result.every(([e]) => e == null);
    }

    public async sendMessage(roomId: string, sessionId: string | undefined, message: string) {
        if (!roomId) { throw new Error(`Invalid roomId('${roomId}')`); }
        if(!sessionId) { throw new Error("Can't reward trophy without knowning the sessionId it was from"); }
        message = message.trim();
        if (message.length > 1024) { message = `${message.slice(0, 1024).trim()}...`; }
        if (!message) { return; }
        // TODO: Pipeline these opperations
        const chatMessages = RedisKeys.roomMessages(roomId);
        const session = await this.getSession(roomId, sessionId);
        await this.client.expire(chatMessages.key, chatMessages.ttl);
        const id = await this.client.xadd(chatMessages.key, "MAXLEN", "~", 32, "*", "json", JSON.stringify({ session, message }));
        return { id, session, message };
    }

    public async webRTCSignal(roomId: string, toSessionId: string, sessionId: string | undefined, webRTC: any) {
        if(!sessionId) { throw new Error("Can't send webrtc signal without knowning the sessionId it was from"); }
        await this.notifySession(roomId, toSessionId, { webRTC: { sessionId, ...webRTC } });
        return true;
    }

    public whiteboardSendEvent(roomId: string, event: string): Promise<boolean> {
        return this.whiteboard.whiteboardSendEvent(roomId, event);
    }

    public whiteboardSendDisplay(roomId: string, display: boolean): Promise<boolean> {
        return this.whiteboard.whiteboardSendDisplay(roomId, display);
    }

    public whiteboardSendPermissions(roomId: string, userId: string, permissions: string): Promise<boolean> {
        return this.whiteboard.whiteboardSendPermissions(roomId, userId, permissions);
    }

    public async mute(roomId: string, sessionId: string, audio?: boolean, video?: boolean): Promise<boolean> {
        await this.notifyRoom(roomId, { mute: { sessionId, audio, video } });
        return true;
    }

    public async endClass(roomId: string, {sessionId, token}: Context): Promise<boolean> {
        if (!token?.teacher) {
            console.log(`Session ${sessionId} attempted to end class!`);
            return false;
        }
        for await (const session of this.getSessions(roomId)) {
            this.userLeave(session.id);
        }
        return true;
    }

    public disconnect(context: any) {
        if (context.sessionId) { this.userLeave(context.sessionId); }
        console.log(`Disconnect: ${JSON.stringify(context.sessionId)}`);
    }

    public async * room(context: Context, roomId: string, name?: string) {
        const { sessionId, websocket, token } = context;
        if(!sessionId) {throw new Error("Can't subscribe to a room without a sessionId");}
        if(!websocket) {throw new Error("Can't subscribe to a room without a websocket");}
        // TODO: Pipeline initial operations
        await this.userJoin(roomId, sessionId, name, token?.teacher);

        const sfu = RedisKeys.roomSfu(roomId);
        const sfuAddress = await this.client.get(sfu.key);
        if (sfuAddress) {
            yield { room: { sfu: sfuAddress } };
        } else {
            const requestKey = RedisKeys.sfuRequest();
            await this.client.rpush(requestKey, roomId);
        }

        // Get room's last contents or supply default blank value
        try {
            const roomContent = RedisKeys.roomContent(roomId);
            const contentJSON = await this.client.get(roomContent.key);
            await this.client.expire(roomContent.key, roomContent.ttl);
            if (contentJSON) {
                const content = JSON.parse(contentJSON);
                yield { room: { content } };
            } else {
                yield { room: { content: { type: "Blank" } } };
            }
        } catch (e) {
            yield { room: { content: { type: "Blank" } } };
        }

        // Get all the sessions within a room
        for await (const session of this.getSessions(roomId)) {
            yield { room: { join: session } };
        }

        // Get room's last messages
        const chatMessages = RedisKeys.roomMessages(roomId);
        let lastMessageIndex = "0";

        // Get general notifications
        const notify = RedisKeys.roomNotify(roomId);
        let lastNotifyIndex = "$";

        // Get personal notifications
        const sessionNotifyKey = RedisKeys.sessionNotify(roomId, sessionId);
        let lastSessionNotifyIndex = "0";

        // Send updates
        const client = this.client.duplicate();
        try {
            while (websocket.readyState === WebSocket.OPEN) {
                const timeoutMs = 1000 * Math.min(notify.ttl, chatMessages.ttl) / 2;
                await client.expire(chatMessages.key, chatMessages.ttl);
                await client.expire(notify.key, notify.ttl);
                const responses = await client.xread(
                    "BLOCK", 10000,
                    "STREAMS",
                    chatMessages.key, notify.key, sessionNotifyKey,
                    lastMessageIndex, lastNotifyIndex, lastSessionNotifyIndex
                );
                if (!responses) { continue; }
                for (const [key, response] of responses) {
                    switch (key) {
                    case notify.key:
                        for (const [id, keyValues] of response) {
                            lastNotifyIndex = id;
                            yield { room: { ...redisStreamDeserialize<any>(keyValues as any) } };
                        }
                        break;
                    case chatMessages.key:

                        for (const [id, keyValues] of response) {
                            lastMessageIndex = id;
                            yield { room: { message: { id, ...redisStreamDeserialize<any>(keyValues as any) } } };
                        }
                        break;
                    case sessionNotifyKey:
                        for (const [id, keyValues] of response) {
                            lastSessionNotifyIndex = id;
                            yield { room: { session: { ...redisStreamDeserialize<any>(keyValues as any) } } };
                        }
                        break;
                    }
                }
            }
        } finally {
            client.disconnect();
        }
    }

    public async * stream({ websocket }: Context, streamId: string, from: string) {
        if(!websocket) {throw new Error("Can't subscribe to a stream without a websocket");}

        const key = RedisKeys.streamEvents(streamId);
        if (!from) { from = "0"; }
        const client = this.client.duplicate(); // We will block
        try {
            while (websocket.readyState === WebSocket.OPEN) {
                client.expire(key, 60 * 5);
                const response = await client.xread("BLOCK", 10000, "STREAMS", key, from);
                if (!response) { continue; }
                const [[, messages]] = response;
                for (const [id, keyValues] of messages) {
                    // ioredis's types definitions are incorrect
                    // keyValues is of type string[], e.g. [key1, value1, key2, value2, key3, value3...]
                    from = id;
                    const m = fromRedisKeyValueArray(keyValues as any);
                    yield {
                        stream: {
                            id,
                            index: Number(m.i) || undefined,
                            checkout: Boolean(m.c),
                            event: m.e
                        }
                    };
                }
            }
        } finally {
            client.disconnect();
        }
    }

    public async * getSessions(roomId: string) {
        const sessionSearchKey = RedisKeys.sessionData(roomId, "*");
        let sessionSearchCursor = "0";
        do {
            const [newCursor, keys] = await this.client.scan(sessionSearchCursor, "MATCH", sessionSearchKey);
            const pipeline = this.client.pipeline();
            for (const key of keys) { pipeline.hgetall(key); }
            const sessions = await pipeline.exec();

            for (const [, session] of sessions) {
                yield convertSessionRecordToSession(session);
            }
            sessionSearchCursor = newCursor;
        } while (sessionSearchCursor !== "0");
    }

    public whiteboardEvents(context: Context, roomId: string) {
        return this.whiteboard.whiteboardEventStream(context, roomId);
    }

    public whiteboardState(context: Context, roomId: string) {
        return this.whiteboard.whiteboardStateStream(context, roomId);
    }

    public whiteboardPermissions(context: Context, roomId: string, userId: string) {
        return this.whiteboard.whiteboardPermissionsStream(context, roomId, userId);
    }

    private async notifyRoom(roomId: string, message: any): Promise<string> {
        const notify = RedisKeys.roomNotify(roomId);
        await this.client.expire(notify.key, notify.ttl);
        return await this.client.xadd(
            notify.key,
            "MAXLEN", "~", 32, "*",
            ...redisStreamSerialize(message)
        );
    }

    private async notifySession(roomId: string, sessionId: string, message: any): Promise<string> {
        const notifyKey = RedisKeys.sessionNotify(roomId, sessionId);
        return await this.client.xadd(
            notifyKey,
            "MAXLEN", "~", 32, "*",
            ...redisStreamSerialize(message)
        );
    }

    private async userJoin(roomId: string, sessionId: string, name?: string, isTeacher?: boolean) {
        const joinedAt = new Date().getTime();
        const sessionKey = RedisKeys.sessionData(roomId, sessionId);
        const pipeline = this.client.pipeline();
        pipeline
            .hset(sessionKey, "id", sessionId)
            .hset(sessionKey, "joinedAt", joinedAt);
        if (name) { pipeline.hset(sessionKey, "name", name); }
        if (isTeacher) { pipeline.hset(sessionKey, "isTeacher", isTeacher.toString()); }
        await pipeline.exec();
        this.notifyRoom(roomId, { join: {id: sessionId, name, isTeacher, joinedAt }});
    }

    private async userLeave(sessionId: string) {
        const sessionSearchKey = RedisKeys.sessionData("*", sessionId);
        let sessionSearchCursor = "0";
        let count = 0;
        const pipeline = this.client.pipeline();
        do {
            const [newCursor, keys] = await this.client.scan(sessionSearchCursor, "MATCH", sessionSearchKey);
            for (const key of keys) {
                const params = RedisKeys.parseSessionDataKey(key);
                if (!params) { continue; }
                const notify = RedisKeys.roomNotify(params.roomId);
                count++;
                pipeline.del(key);
                pipeline.expire(notify.key, notify.ttl);
                pipeline.xadd(
                    notify.key,
                    "MAXLEN", "~", (32 + count).toString(), "*",
                    ...redisStreamSerialize({ leave: { id: params.sessionId } })
                );
            }
            sessionSearchCursor = newCursor;
        } while (sessionSearchCursor !== "0");
        await pipeline.exec();
    }

    public async video(roomId: string, sessionId: string, src?: string, play?: boolean, offset?: number) {
        if (src === undefined && play === undefined && offset === undefined) { return true; }

        const timePromise = this.getTime();
        const pipeline = this.client.pipeline();
        const state = RedisKeys.videoState(roomId, sessionId);
        pipeline.expire(state.key, state.ttl);
        const stream = RedisKeys.videoStateChanges(roomId, sessionId);
        pipeline.expire(stream.key, stream.ttl);

        if (src !== undefined) { pipeline.hset(state.key, "src", src); }
        if (play !== undefined) { pipeline.hset(state.key, "play", play ? "true" : ""); }
        if (offset !== undefined) { pipeline.hset(state.key, "offset", offset); }

        const time = await timePromise;
        pipeline.hset(state.key, "time", time);
        pipeline.xadd(stream.key, "MAXLEN", "~", "32", "*", "json", JSON.stringify({ src, play, time, offset }));
        await pipeline.exec();

        return true;
    }
    public async * videoSubscription({ websocket }: Context, roomId: string, sessionId: string) {
        if(!websocket) {throw new Error("Can't subscribe to a video notifications without a websocket");}
        const video = RedisKeys.videoState(roomId, sessionId);
        {
            const state = await this.client.hgetall(video.key);
            const play = Boolean(state["play"]);
            let offset = Number(state["offset"]);
            if (play) {
                const delta = (await this.getTime()) - Number(state["time"]);
                offset += delta || 0;
            }
            yield { video: { src: state["src"], play, offset } };
        }
        const stream = RedisKeys.videoStateChanges(roomId, sessionId);
        let from = "$";
        const client = this.client.duplicate(); // We will block
        try {
            while (websocket.readyState === WebSocket.OPEN) {
                client.expire(video.key, video.ttl);
                client.expire(stream.key, stream.ttl);
                const response = await client.xread("BLOCK", 10000, "STREAMS", stream.key, from);
                if (!response) { continue; }
                const [[, messages]] = response;
                //TODO: optimize to only send most recent message
                for (const [id, keyValues] of messages) {
                    // ioredis's types definitions are incorrect
                    // keyValues is of type string[], e.g. [key1, value1, key2, value2, key3, value3...]
                    from = id;
                    const state = redisStreamDeserialize(keyValues as any) as any;
                    const delta = (await this.getTime()) - Number(state["time"]);
                    const offset = Number(state["offset"]) + delta;
                    yield { video: { src: state["src"], play: Boolean(state["play"]), offset: Number.isFinite(offset) ? offset : undefined } };
                }
            }
        } finally {
            client.disconnect();
        }
    }

    public async rewardTrophy(roomId: string, user: string, kind: string, sessionId?: string): Promise<boolean> {
        if(!sessionId) { throw new Error("Can't reward trophy without knowning the sessionId it was from"); }
        await this.notifyRoom(roomId, { trophy: { from: sessionId, user, kind } });
        return true;
    }

    private async getTime() {
        const [seconds, microseconds] = await this.client.time();
        return Number(seconds) + Number(microseconds) / 1e6;
    }
}
