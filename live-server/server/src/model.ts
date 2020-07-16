import { fromRedisKeyValueArray, redisStreamDeserialize, redisStreamSerialize } from "./utils";
import { RedisKeys } from "./redisKeys";
import Redis = require("ioredis")
import { WhiteboardService } from "./services/whiteboard/WhiteboardService";
import { IWhiteboardService } from "./services/whiteboard/IWhiteboardService";

interface PageEvent {
  sequenceNumber: number
  isKeyframe: boolean
  eventsSinceKeyframe: number
  eventData: string
}

export class Model {
    public static async create () {
        const redis = new Redis({
            host: process.env.REDIS_HOST,
            port: Number(process.env.REDIS_PORT) || undefined,
            lazyConnect: true
        });
        await redis.connect();
        console.log("🔴 Redis database connected");
        return new Model(redis);
    }

    private client: Redis.Redis
    private whiteboard: IWhiteboardService

    private constructor (client: Redis.Redis) {
        this.client = client;
        this.whiteboard = new WhiteboardService(client);
    }

    public async getSession (roomId: string, sessionId: string) {
        const sessionKey = RedisKeys.sessionData(roomId, sessionId);
        const sessionKeyValues = await this.client.hgetall(sessionKey);
        return { ...sessionKeyValues };
    }

    public async setSessionStreamId (roomId: string, sessionId: string, streamId: string) {
        const sessionKey = RedisKeys.sessionData(roomId, sessionId);
        await this.client.pipeline()
            .hset(sessionKey, "id", sessionId)
            .hset(sessionKey, "streamId", streamId)
            .exec();
        const session = await this.getSession(roomId, sessionId);
        this.notifyRoom(roomId, { join: session });
    }

    public async showContent (roomId: string, type: string, contentId?: string) {
        const roomContent = RedisKeys.roomContent(roomId);
        const content = { type, contentId };
        await this.notifyRoom(roomId, { content });
        await this.client.set(roomContent.key, JSON.stringify(content));
        await this.client.expire(roomContent.key, roomContent.ttl);
    }

    public async postPageEvent (streamId: string, pageEvents: PageEvent[]) {
        const key = RedisKeys.streamEvents(streamId);
        const pipeline = this.client.pipeline();

        for (const {eventsSinceKeyframe, isKeyframe, eventData } of pageEvents) {
        
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

    public async sendMessage (roomId: string, sessionId: string, message: string) {
        if (!roomId) { throw new Error(`Invalid roomId('${roomId}')`); }
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

    public async webRTCSignal (roomId: string, toSessionId: string, sessionId: string, webRTC: any) {
        await this.notifySession(roomId, toSessionId, { webRTC: { sessionId, ...webRTC } });
        return true;
    }

    public whiteboardSendEvent(roomId: string, event: string): Promise<boolean> {
        return this.whiteboard.whiteboardSendEvent(roomId, event);
    }

    public whiteboardSendDisplay(roomId: string, display: boolean) : Promise<boolean> {
        return this.whiteboard.whiteboardSendDisplay(roomId, display);
    }

    public disconnect (context: any) {
        if (context.sessionId) { this.userLeave(context.sessionId); }
        console.log(`Disconnect: ${JSON.stringify(context.sessionId)}`);
    }

    public async * room (roomId: string, sessionId: string, name?: string) {
        // TODO: Pipeline initial opperations
        await this.userJoin(roomId, sessionId, name);

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
        {
            const sessionSearchKey = RedisKeys.sessionData(roomId, "*");
            let sessionSearchCursor = "0";
            do {
                const [newCursor, keys] = await this.client.scan(sessionSearchCursor, "MATCH", sessionSearchKey);
                const pipeline = this.client.pipeline();
                for (const key of keys) { pipeline.hgetall(key); }
                const sessions = await pipeline.exec();

                for (const [, session] of sessions) {
                    yield { room: { join: session } };
                }
                sessionSearchCursor = newCursor;
            } while (sessionSearchCursor !== "0");
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
            while (true) {
                const timeoutMs = 1000 * Math.min(notify.ttl, chatMessages.ttl) / 2;
                await client.expire(chatMessages.key, chatMessages.ttl);
                await client.expire(notify.key, notify.ttl);
                const responses = await client.xread(
                    "BLOCK", timeoutMs,
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

    public async * stream (streamId: string, from:string) {
        const key = RedisKeys.streamEvents(streamId);
        if (!from) { from = "0"; }
        const client = this.client.duplicate(); // We will block
        try {
            while (true) {
                client.expire(key, 60 * 5);
                const response = await client.xread("BLOCK", 1000 * 60, "STREAMS", key, from);
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

    public whiteboardEvents(roomId: string) {
        return this.whiteboard.whiteboardEventStream(roomId);
    }

    public whiteboardState(roomId: string) {
        return this.whiteboard.whiteboardStateStream(roomId);
    }

    private async notifyRoom (roomId:string, message: any): Promise<string> {
        const notify = RedisKeys.roomNotify(roomId);
        await this.client.expire(notify.key, notify.ttl);
        return await this.client.xadd(
            notify.key,
            "MAXLEN", "~", 32, "*",
            ...redisStreamSerialize(message)
        );
    }

    private async notifySession (roomId: string, sessionId: string, message: any): Promise<string> {
        const notifyKey = RedisKeys.sessionNotify(roomId, sessionId);
        return await this.client.xadd(
            notifyKey,
            "MAXLEN", "~", 32, "*",
            ...redisStreamSerialize(message)
        );
    }

    private async userJoin (roomId: string, sessionId: string, name?: string) {
        const sessionKey = RedisKeys.sessionData(roomId, sessionId);
        await this.client.hmset(sessionKey, "id", sessionId);
        if (name) { await this.client.hmset(sessionKey, "name", name); }
        await this.notifyRoom(roomId, { join: { id: sessionId, name } });
    }

    private async userLeave (sessionId: string) {
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

    private async getStreamsLastGeneratedId (key: string): Promise<string> {
        try {
            const info = await this.client.xinfo("STREAM", key);
            return info[8];
        } catch (e) {
            return "$";
        }
    }

    private async duplicateClient<T> (f:(client: Redis.Redis) => Promise<T>): Promise<T> {
        const client = this.client.duplicate();
        try {
            return await f(client);
        } finally {
            client.disconnect();
        }
    }
}
