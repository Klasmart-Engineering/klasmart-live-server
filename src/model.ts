import { RedisKeys } from "./redisKeys";
import { WhiteboardService } from "./services/whiteboard/WhiteboardService";
import {
    Attendance,
    ClassType,
    Context,
    PageEvent,
    Session,
    StudentReport,
    StudentReportActionType,
} from "./types";
import {
    convertSessionRecordToSession,
    fromRedisKeyValueArray,
    redisStreamDeserialize,
    redisStreamSerialize,
} from "./utils";
import  Redis from "ioredis";
import WebSocket = require("ws");
import {
    GET_ATTENDANCE_QUERY,
    SAVE_ATTENDANCE_MUTATION,
    SAVE_FEEDBACK_MUTATION,
} from "./graphql";
import {
    attendanceToken,
    studentReportToken,
} from "./jwt";
import { Pipeline } from "./pipeline";
import axios from "axios";
import request from "graphql-request";

export class Model {
    public static async createClient () {
        const redisMode = process.env.REDIS_MODE ?? `NODE`;
        const port = Number(process.env.REDIS_PORT) || undefined;
        const host = process.env.REDIS_HOST;
        const password = process.env.REDIS_PASS;
        const lazyConnect = true;

        let redis: Redis.Redis | Redis.Cluster;
        if (redisMode === `CLUSTER`) {
            redis = new Redis.Cluster([
                {
                    port,
                    host,
                },
            ], {
                lazyConnect,
                redisOptions: {
                    password,
                },
            });
        } else {
            redis = new Redis(port, host, {
                lazyConnect: true,
                password,
            });
        }
        await redis.connect();
        return redis;
    }

    public static async create () {
        const redis = await this.createClient();
        console.log(`🔴 Redis database connected`);
        return new Model(redis);
    }

    private whiteboard: WhiteboardService;
    private client: Redis.Cluster | Redis.Redis

    private constructor (client: Redis.Cluster | Redis.Redis) {
        this.client = client;
        this.whiteboard = new WhiteboardService(client);

        setInterval(() => {
            this.checkTempStorage();
        }, 60*1000);
    }

    public async getSession (roomId: string, sessionId: string): Promise<Session> {
        const sessionKey = RedisKeys.sessionData(roomId, sessionId);
        const sessionRecord = await this.client.hgetall(sessionKey);
        return convertSessionRecordToSession(sessionRecord);
    }

    public async getSfuAddress (roomId: string) {
        const sfu = RedisKeys.roomSfu(roomId);
        const address = await this.client.get(sfu.key);
        if (address) { return address; }

        const notify = RedisKeys.roomNotify(roomId);
        let lastNotifyIndex = `$`;
        const endTime = Date.now() + 15 * 1000;
        while (Date.now() < endTime) {
            const responses = await this.client.xread(`BLOCK`, 15, `STREAMS`, notify.key, lastNotifyIndex);
            if (!responses) { continue; }
            for (const [ , response ] of responses) {
                for (const [ id, keyValues ] of response) {
                    lastNotifyIndex = id;
                    const { sfuAddress } = redisStreamDeserialize<SFUEntry>(keyValues) as SFUEntry;
                    if (sfuAddress) { return sfuAddress; }
                }
            }
        }
        return undefined;
    }

    public async setSessionStreamId (roomId: string, sessionId: string | undefined, streamId: string) {
        if(!sessionId) { throw new Error(`Can't setSessionStreamId without knowing the sessionId it was from`); }
        const sessionKey = RedisKeys.sessionData(roomId, sessionId);
        const pipeline = new Pipeline(this.client);
        await pipeline.hset(sessionKey, `id`, sessionId);
        await pipeline.hset(sessionKey, `streamId`, streamId);
        await pipeline.exec();

        const session = await this.getSession(roomId, sessionId);
        await this.notifyRoom(roomId, {
            join: session,
        });
    }

    public async setHost (roomId: string, nextHostId: string) {
        if(!nextHostId) { throw new Error(`Can't set the host without knowing the sessionId of the new host`); }

        const roomHostKey = RedisKeys.roomHost(roomId);
        const nextHostSessionKey = RedisKeys.sessionData(roomId, nextHostId);

        const previousHostId = await this.client.getset(roomHostKey.key, nextHostId);

        if(previousHostId === nextHostId) { return; } // The host has not changed

        const pipeline = new Pipeline(this.client);
        await pipeline.hset(nextHostSessionKey, `isHost`, `true`);
        await pipeline.expire(roomHostKey.key, roomHostKey.ttl);

        if (previousHostId) {
            const previousHostSessionKey = RedisKeys.sessionData(roomId, previousHostId);
            await pipeline.hset(previousHostSessionKey, `isHost`, `false`);
        }
        await pipeline.exec();

        const join = await this.getSession(roomId, nextHostId);
        this.notifyRoom(roomId, {
            join,
        }).catch((e) => console.log(e));

        if(previousHostId) {
            const join = await this.getSession(roomId, previousHostId);
            this.notifyRoom(roomId, {
                join,
            }).catch((e) => console.log(e));
        }
    }

    public async showContent (roomId: string, type: string, contentId?: string) {
        const roomContent = RedisKeys.roomContent(roomId);
        const content = {
            type,
            contentId,
        };
        await this.notifyRoom(roomId, {
            content,
        });
        await this.client.set(roomContent.key, JSON.stringify(content));
        await this.client.expire(roomContent.key, roomContent.ttl);
    }

    public async postPageEvent (streamId: string, pageEvents: PageEvent[]) {
        const key = RedisKeys.streamEvents(streamId);
        const pipeline = new Pipeline(this.client);
        for (const {
            eventsSinceKeyframe, isKeyframe, eventData,
        } of pageEvents) {
            await pipeline.xadd(key, `MAXLEN`, `~`, (eventsSinceKeyframe + 1).toString(), `*`, `i`, eventsSinceKeyframe.toString(), `c`, isKeyframe.toString(), `e`, eventData);
        }
        await pipeline.expire(key, 60);
        if (process.env.REDIS_MODE !== `CLUSTER`) {
            const result = await pipeline.exec();
            return result.every(([ e ]) => e == null);
        } else {
            return true;
        }
    }

    public async sendMessage (roomId: string, sessionId: string | undefined, message: string) {
        if (!roomId) { throw new Error(`Invalid roomId('${roomId}')`); }
        if(!sessionId) { throw new Error(`Can't reward trophy without knowing the sessionId it was from`); }
        message = message.trim();
        if (message.length > 1024) { message = `${message.slice(0, 1024).trim()}...`; }
        if (!message) { return; }
        // TODO: Pipeline these operations
        const chatMessages = RedisKeys.roomMessages(roomId);
        const session = await this.getSession(roomId, sessionId);
        await this.client.expire(chatMessages.key, chatMessages.ttl);
        const id = await this.client.xadd(chatMessages.key, `MAXLEN`, `~`, 256, `*`, `json`, JSON.stringify({
            session,
            message,
        }));
        return {
            id,
            session,
            message,
        };
    }

    public async webRTCSignal (roomId: string, toSessionId: string, sessionId: string | undefined, webRTC: any) {
        if(!sessionId) { throw new Error(`Can't send webrtc signal without knowing the sessionId it was from`); }
        await this.notifySession(roomId, toSessionId, {
            webRTC: {
                sessionId,
                ...webRTC,
            },
        });
        return true;
    }

    public whiteboardSendEvent (roomId: string, event: string): Promise<boolean> {
        return this.whiteboard.whiteboardSendEvent(roomId, event);
    }

    public whiteboardSendDisplay (roomId: string, display: boolean): Promise<boolean> {
        return this.whiteboard.whiteboardSendDisplay(roomId, display);
    }

    public whiteboardSendPermissions (roomId: string, userId: string, permissions: string): Promise<boolean> {
        return this.whiteboard.whiteboardSendPermissions(roomId, userId, permissions);
    }

    public async mute (roomId: string, sessionId: string, audio?: boolean, video?: boolean): Promise<boolean> {
        await this.notifyRoom(roomId, {
            mute: {
                sessionId,
                audio,
                video,
            },
        });
        return true;
    }

    public async endClass (context: Context): Promise<boolean> {
        const { sessionId, authorizationToken } = context;
        if (!authorizationToken?.teacher) {
            console.log(`Session ${sessionId} attempted to end class!`);
            return false;
        }
        const pipeline = new Pipeline(this.client);
        const roomId = authorizationToken.roomid;

        // delete class host
        const roomHost = RedisKeys.roomHost(roomId);
        await pipeline.del(roomHost.key);

        for await (const session of this.getSessions(roomId)) {
            const sessionKey = RedisKeys.sessionData(roomId, session.id);
            const roomSessions = RedisKeys.roomSessions(roomId);
            await pipeline.del(sessionKey);
            await pipeline.srem(roomSessions, sessionKey);
            await this.notifyRoom(roomId, {
                leave: session,
            });
            await this.logAttendance(roomId, session, context);
        }

        await pipeline.exec();
        // when teacher end class trigger attendance
        await this.sendAttendance(authorizationToken.roomid, context.authorizationToken?.classtype);

        return true;
    }

    public async disconnect (context: Context | any) {
        console.log(`Disconnect: ${JSON.stringify(context.sessionId)}`);
        await this.userLeave(context);
        return true;
    }

    public async * room (context: Context, roomId: string, name?: string) {
        const {
            sessionId,
            websocket,
            authorizationToken,
            authenticationToken,
        } = context;
        if(!authorizationToken) {throw new Error(`Can't subscribe to a room without a token`);}
        if(!sessionId) {throw new Error(`Can't subscribe to a room without a sessionId`);}
        if(!websocket) {throw new Error(`Can't subscribe to a room without a websocket`);}
        if(context.roomId) { console.error(`Session(${sessionId}) already subscribed to Room(${context.roomId}) and will now subscribe to Room(${roomId}) attendance records do not support multiple rooms`); }
        context.roomId = roomId;
        // TODO: Pipeline initial operations
        await this.userJoin(roomId, sessionId, authorizationToken.userid, name ?? authorizationToken.name, authorizationToken.teacher, authenticationToken?.email);

        if(authorizationToken.classtype === ClassType.LIVE){
            const tempStorageKeys = RedisKeys.tempStorageKeys();
            const tempStorageSingleKey = RedisKeys.tempStorageKey(roomId);
            const tempStorageSingleData = await this.client.get(tempStorageSingleKey);
            if(!tempStorageSingleData){
                // send after n hour
                const time = new Date(authorizationToken.endat*1000);
                if( time > new Date()) {
                    time.setSeconds(time.getSeconds() + Number(process.env.ASSESSMENT_GENERATE_TIME || 300));
                    await this.client.set(tempStorageSingleKey, time.getTime());
                    await this.client.sadd(tempStorageKeys, roomId);
                }
            }
        }
        const sfu = RedisKeys.roomSfu(roomId);
        const sfuAddress = await this.client.get(sfu.key);
        if (sfuAddress) {
            yield {
                room: {
                    sfu: sfuAddress,
                },
            };
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
                yield {
                    room: {
                        content,
                    },
                };
            } else {
                yield {
                    room: {
                        content: {
                            type: `Blank`,
                        },
                    },
                };
            }
        } catch (e) {
            yield {
                room: {
                    content: {
                        type: `Blank`,
                    },
                },
            };
        }

        // Get all the sessions within a room
        const sessions = [];
        for await (const session of this.getSessions(roomId)) {
            if(!session.id) { continue; }
            sessions.push(session);
        }
        const sortedSessions = sessions.sort((a: Session) => a.isHost ? -1 : 1);
        for (const session of sortedSessions) {
            yield {
                room: {
                    join: session,
                },
            };
        }

        // Get room's last messages
        const chatMessages = RedisKeys.roomMessages(roomId);
        let lastMessageIndex = `0`;

        // Get general notifications
        const notify = RedisKeys.roomNotify(roomId);
        let lastNotifyIndex = `$`;

        // Get personal notifications
        const sessionNotifyKey = RedisKeys.sessionNotify(roomId, sessionId);
        let lastSessionNotifyIndex = `0`;

        // Send updates
        const client = this.client.duplicate();
        try {
            while (websocket.readyState === WebSocket.OPEN) {
                await client.expire(chatMessages.key, chatMessages.ttl);
                await client.expire(notify.key, notify.ttl);
                const responses = await client.xread(`BLOCK`, 10000, `STREAMS`, chatMessages.key, notify.key, sessionNotifyKey, lastMessageIndex, lastNotifyIndex, lastSessionNotifyIndex);
                if (!responses) { continue; }

                for (const [ key, response ] of responses) {
                    switch (key) {
                    case notify.key:
                        for (const [ id, keyValues ] of response) {
                            lastNotifyIndex = id;
                            yield {
                                room: {
                                    ...redisStreamDeserialize<any>(keyValues),
                                },
                            };
                        }
                        break;
                    case chatMessages.key:

                        for (const [ id, keyValues ] of response) {
                            lastMessageIndex = id;
                            yield {
                                room: {
                                    message: {
                                        id,
                                        ...redisStreamDeserialize<any>(keyValues),
                                    },
                                },
                            };
                        }
                        break;
                    case sessionNotifyKey:
                        for (const [ id, keyValues ] of response) {
                            lastSessionNotifyIndex = id;
                            yield {
                                room: {
                                    session: {
                                        ...redisStreamDeserialize<any>(keyValues),
                                    },
                                },
                            };
                        }
                        break;
                    }
                }
            }
        } catch (e) {
            console.error(e);
        }
        finally {
            client.disconnect();
        }
    }

    public async * stream ({ websocket }: Context, streamId: string, from: string) {
        if(!websocket) {throw new Error(`Can't subscribe to a stream without a websocket`);}

        const key = RedisKeys.streamEvents(streamId);
        if (!from) { from = `0`; }
        const client = this.client.duplicate(); // We will block
        try {
            while (websocket.readyState === WebSocket.OPEN) {
                await client.expire(key, 60 * 5);
                const response = await client.xread(`BLOCK`, 10000, `STREAMS`, key, from);
                // console.log(streamId, 'response');
                if (!response) { continue; }
                const [ [ , messages ] ] = response;
                for (const [ id, keyValues ] of messages) {
                    from = id;
                    const m = fromRedisKeyValueArray(keyValues);
                    yield {
                        stream: {
                            id,
                            index: Number(m.i) || undefined,
                            checkout: Boolean(m.c),
                            event: m.e,
                        },
                    };
                }
            }
        }
        catch(e) {
            console.error(e);
        }
        finally {
            client.disconnect();
        }
    }

    public async * getSessions (roomId: string) {
        const roomSessionsKey = RedisKeys.roomSessions(roomId);
        let sessionSearchCursor = `0`;
        do {
            const [ newCursor, keys ] = await this.client.sscan(roomSessionsKey, sessionSearchCursor);
            const pipeline = new Pipeline(this.client);
            for (const key of keys) {
                await pipeline.hgetall(key);
            }
            const sessions = await pipeline.exec();
            for (const [ , session ] of sessions) {
                yield convertSessionRecordToSession(session);
            }
            sessionSearchCursor = newCursor;
        } while (sessionSearchCursor !== `0`);
    }

    public whiteboardEvents (context: Context, roomId: string) {
        return this.whiteboard.whiteboardEventStream(context, roomId);
    }

    public whiteboardState (context: Context, roomId: string) {
        return this.whiteboard.whiteboardStateStream(context, roomId);
    }

    public whiteboardPermissions (context: Context, roomId: string, userId: string) {
        return this.whiteboard.whiteboardPermissionsStream(context, roomId, userId);
    }

    private async notifyRoom (roomId: string, message: any): Promise<string> {
        const activityType = message?.content?.type;
        if (activityType === `Activity` || activityType === `Stream`) { //delete old Streams
            await this.deleteOldStreamId(roomId, activityType);
        }
        const notify = RedisKeys.roomNotify(roomId);
        await this.client.expire(notify.key, notify.ttl);
        const res = await this.client.xadd(notify.key, `MAXLEN`, `~`, 32, `*`, ...redisStreamSerialize(message));
        return res;
    }

    private async notifySession (roomId: string, sessionId: string, message: any): Promise<string> {
        const notifyKey = RedisKeys.sessionNotify(roomId, sessionId);
        const res = await this.client.xadd(notifyKey, `MAXLEN`, `~`, 32, `*`, ...redisStreamSerialize(message));
        return res;
    }

    private async userJoin (roomId: string, sessionId: string, userId: string, name?: string, isTeacher?: boolean, email?: string) {
        const joinedAt = new Date().getTime();
        const sessionKey = RedisKeys.sessionData(roomId, sessionId);
        const roomSessions = RedisKeys.roomSessions(roomId);
        const roomHostKey = RedisKeys.roomHost(roomId);
        const pipeline = new Pipeline(this.client);

        await pipeline.hset(sessionKey, `id`, sessionId);
        await pipeline.hset(sessionKey, `name`, name || ``);
        await pipeline.hset(sessionKey, `userId`, userId);
        await pipeline.hset(sessionKey, `joinedAt`, joinedAt);
        await pipeline.hset(sessionKey, `email`, email||``);
        await pipeline.hset(sessionKey, `isTeacher`, Boolean(isTeacher).toString());
        await pipeline.sadd(roomSessions, sessionKey);
        await pipeline.exec();

        if(isTeacher) {
            const becameHost = await this.client.set(roomHostKey.key, sessionId, `EX`, roomHostKey.ttl, `NX`);
            if(becameHost) { await this.client.hset(sessionKey, `isHost`, `true`); }
        }

        const join = await this.getSession(roomId, sessionId);
        console.log(`session: `, join);
        await this.notifyRoom(roomId, {
            join,
        });
    }

    private async userLeave (context: Context) {
        console.log(`userLeft: `, context?.authorizationToken?.classtype);
        const { sessionId } = context;
        const roomId = context?.authorizationToken?.roomid;
        if(sessionId === undefined || roomId === undefined) { return; }

        const roomHostKey = RedisKeys.roomHost(roomId);
        const roomSessions = RedisKeys.roomSessions(roomId);
        const sessionKey = RedisKeys.sessionData(roomId, sessionId);
        const roomHostId = await this.client.get(roomHostKey.key);
        const changeRoomHost = (roomHostId === sessionId);

        // If using Redis in cluster mode, a pipeline requires all operations to be performed on the
        // same node, otherwise you will get an error.  This keeps compatibility with using node mode.
        const pipeline =  new Pipeline(this.client);

        if (changeRoomHost) { await pipeline.del(roomHostKey.key); }

        //Get and delete session
        const session = await this.getSession(roomId, sessionId);
        await pipeline.srem(roomSessions, sessionKey);
        await pipeline.del(sessionKey);

        // Notify other participants that this user has left
        const notify = RedisKeys.roomNotify(roomId);
        await pipeline.expire(notify.key, notify.ttl);
        await pipeline.xadd(notify.key, `MAXLEN`, `~`, `64`, `*`, ...redisStreamSerialize({
            leave: {
                id: sessionId,
            },
        }));

        //Log Attendance
        await this.logAttendance(roomId, session, context);
        await pipeline.exec();

        //Select new host
        if (changeRoomHost) {
            const teachers = await this.getRoomParticipants(roomId, true, true);
            if(teachers.length > 0){
                const firstJoinedTeacher = teachers[0];
                await this.setHost(roomId, firstJoinedTeacher.id);
            }
        }

        await this.attendanceNotify(roomId, context);
    }

    private async logAttendance (roomId: string, session: Session, context: Context) {
        const url = process.env.ATTENDANCE_SERVICE_ENDPOINT;
        const { authorizationToken } = context;
        if(!url || !authorizationToken || !session.id) return;
        // in LIVE class, start saving attendances 5 mins before class start time
        // and until 30 mins after class end time
        const classStartTime = authorizationToken.startat - 300;
        const classEndTime = authorizationToken.endat + 1800;
        const currentTime = Math.floor(new Date().getTime()/1000);
        const ok = classStartTime <= currentTime && currentTime <= classEndTime;

        if(authorizationToken?.classtype === ClassType.LIVE && !ok) return;
        const variables = {
            roomId: roomId,
            sessionId: session.id,
            userId: session.userId,
            joinTimestamp: new Date(session.joinedAt),
            leaveTimestamp: new Date(),
        };

        await request(url, SAVE_ATTENDANCE_MUTATION, variables).then((data) => {
            const attendance = data.saveAttendance;
            console.log(`saved attendance: `, attendance);
        }).catch((e) => {
            console.log(`could not save attendance: `, e);
        });
    }

    private async attendanceNotify (roomId: string, context: Context) {
        //There were no sessions in room
        //Maybe we need a timeout to check no one rejoins
        const roomSessions = RedisKeys.roomSessions(roomId);
        const numSessions = await this.client.scard(roomSessions);
        if (numSessions <= 0) {
            if(context.authorizationToken?.classtype !== ClassType.LIVE){
                await this.sendAttendance(roomId, context.authorizationToken?.classtype);
            }
        }
    }

    private async sendAttendance (roomId: string, classType?: string) {
        const assessmentUrl = process.env.ASSESSMENT_ENDPOINT;
        const attendanceUrl = process.env.ATTENDANCE_SERVICE_ENDPOINT;

        if(!assessmentUrl || !attendanceUrl) {return;}

        try {
            let attendance: Attendance [] = [];

            await request(attendanceUrl, GET_ATTENDANCE_QUERY, {
                roomId: roomId,
            }).then((data: any) => {
                attendance = data.getClassAttendance;
                console.log(`received attendance: `, attendance);
            }).catch((e) => {
                console.log(`could not get attendance: `, e);
            });

            const attendanceIds = new Set([ ...attendance.map((a) => a.userId) ]);
            if(classType === ClassType.LIVE && attendanceIds.size <= 1){
                return;
            }
            const now = Number(new Date());
            const classEndTimeMS = Math.max(...attendance.map((a) => Number(new Date(a.leaveTimestamp).getTime())), now);
            const classendTimeSec = Math.round(classEndTimeMS / 1000);
            const classStartTimeMS = Math.min(...attendance.map((a) => Number(new Date(a.joinTimestamp).getTime())), now);
            const classstartTimeSec = Math.round(classStartTimeMS / 1000);
            const token = await attendanceToken(roomId, [ ...attendanceIds ], classstartTimeSec, classendTimeSec);
            await axios.post(assessmentUrl, {
                token,
            });

        } catch(e) {
            console.log(`Unable to post attendance`);
            console.error(e);
        }
    }

    public async video (roomId: string, sessionId: string, src?: string, play?: boolean, offset?: number) {
        if (src === undefined && play === undefined && offset === undefined) { return true; }

        const timePromise = this.getTime();
        const pipeline = this.client.pipeline();
        const state = RedisKeys.videoState(roomId, sessionId);
        pipeline.expire(state.key, state.ttl);
        const stream = RedisKeys.videoStateChanges(roomId, sessionId);
        pipeline.expire(stream.key, stream.ttl);

        if (src !== undefined) { pipeline.hset(state.key, `src`, src); }
        if (play !== undefined) { pipeline.hset(state.key, `play`, play ? `true` : ``); }
        if (offset !== undefined) { pipeline.hset(state.key, `offset`, offset); }

        const time = await timePromise;
        pipeline.hset(state.key, `time`, time);
        pipeline.xadd(stream.key, `MAXLEN`, `~`, `32`, `*`, `json`, JSON.stringify({
            src,
            play,
            time,
            offset,
        }));
        await pipeline.exec();

        return true;
    }
    public async * videoSubscription ({ websocket }: Context, roomId: string, sessionId: string) {
        if(!websocket) {throw new Error(`Can't subscribe to a video notifications without a websocket`);}
        const video = RedisKeys.videoState(roomId, sessionId);
        {
            const state = await this.client.hgetall(video.key);
            const play = Boolean(state[`play`]);
            let offset = Number(state[`offset`]);
            if (play) {
                const delta = (await this.getTime()) - Number(state[`time`]);
                offset += delta || 0;
            }
            yield {
                video: {
                    src: state[`src`],
                    play,
                    offset,
                },
            };
        }
        const stream = RedisKeys.videoStateChanges(roomId, sessionId);
        let from = `$`;
        const client = this.client.duplicate(); // We will block
        try {
            while (websocket.readyState === WebSocket.OPEN) {
                await client
                    .pipeline()
                    .expire(video.key, video.ttl)
                    .expire(stream.key, stream.ttl)
                    .exec();
                const response = await client.xread(`BLOCK`, 10000, `STREAMS`, stream.key, from);
                if (!response) { continue; }
                const [ [ , messages ] ] = response;
                //TODO: optimize to only send most recent message
                for (const [ id, keyValues ] of messages) {
                    from = id;
                    const state = redisStreamDeserialize<any>(keyValues);
                    const delta = (await this.getTime()) - Number(state[`time`]);
                    const offset = Number(state[`offset`]) + delta;
                    yield {
                        video: {
                            src: state[`src`],
                            play: Boolean(state[`play`]),
                            offset: Number.isFinite(offset) ? offset : undefined,
                        },
                    };
                }
            }
        }
        catch (e) {
            console.error(e);
        }
        finally {
            client.disconnect();
        }
    }

    public async rewardTrophy (roomId: string, user: string, kind: string, sessionId?: string): Promise<boolean> {
        if(!sessionId) { throw new Error(`Can't reward trophy without knowing the sessionId it was from`); }
        await this.notifyRoom(roomId, {
            trophy: {
                from: sessionId,
                user,
                kind,
            },
        });
        return true;
    }

    public async saveFeedback (context: Context, stars: number, feedbackType: string, comment: string, quickFeedback: {type: string; stars: number}[]) {
        const url = process.env.ATTENDANCE_SERVICE_ENDPOINT;

        if(!context.authorizationToken || !context.sessionId || !url) { return; }
        const variables = {
            roomId: context.authorizationToken.roomid,
            userId: context.authorizationToken.userid,
            sessionId: context.sessionId,
            stars: stars,
            comment: comment,
            feedbackType: feedbackType,
            quickFeedback: quickFeedback,
        };
        await request(url, SAVE_FEEDBACK_MUTATION, variables).then((data) => {
            const feedback = data.saveFeedback;
            console.log(`\nsaved feedback: `, feedback);
        }).catch((e) => {
            console.log(`could not save feedback: `, e);
        });

        return true;
    }

    private async getTime () {
        const [ seconds, microseconds ] = await this.client.time();
        return Number(seconds) + Number(microseconds) / 1e6;
    }

    public async getRoomParticipants (roomId: string, isTeacher = true,  sort = false){
        const sessions = [];
        for await (const session of this.getSessions(roomId)) {
            if(session.isTeacher === isTeacher) { sessions.push(session); }
        }
        if (sort) {
            sessions.sort((a: Session, b: Session) => a.joinedAt - b.joinedAt);
        }
        return sessions;
    }

    private async deleteOldStreamId (roomId: string, activityType: string) {
        const roomActivityTypeKey = RedisKeys.activityType(roomId);
        const roomActivityType = await this.client.get(roomActivityTypeKey.key);

        if(!roomActivityType) {
            await this.client.set(roomActivityTypeKey.key, activityType);
        } else {
            await this.client.set(roomActivityTypeKey.key, activityType);
            if(roomActivityType !== activityType){
                const studentSessions = await this.getRoomParticipants(roomId, false);
                for await (const studentSession of studentSessions) {
                    if (studentSession.streamId){
                        const studentSessionKey = RedisKeys.sessionData(roomId, studentSession.id);
                        await this.client
                            .hset(studentSessionKey, `streamId`, `` );
                        const session = await this.getSession(roomId, studentSession.id);
                        await this.notifyRoom(roomId, {
                            join: session,
                        });
                    }
                }
            }
        }
    }

    public async studentReport (roomId: string, context: Context, materialUrl: string, activityTypeName: string){
        const url = process.env.STUDENT_REPORT_ENDPOINT;
        const classtype = context.authorizationToken?.classtype;
        if(!url || !(materialUrl && activityTypeName && classtype)) return;

        try{
            const userStatistics: StudentReport = {
                classType: classtype,
                lessonMaterialUrl: materialUrl,
                contentType: activityTypeName.toLowerCase(),
                actionType: StudentReportActionType.VIEWED,
            };

            const studentSessions = await this.getRoomParticipants(roomId, false);
            const students: Student[] = [];
            const recordedAt = new Date().getTime();
            const requestBody: RequestBody = {
                room_id: roomId,
                class_type: userStatistics.classType,
                lesson_material_url: userStatistics.lessonMaterialUrl,
                content_type: userStatistics.contentType,
                action_type: userStatistics.actionType,
                timestamp: recordedAt,
                students: [],
            };
            for await (const session of studentSessions){
                const student: Student = {
                    user_id: session.userId,
                    email: session.email,
                    name: session.name,
                };
                students.push(student);
            }
            requestBody.students = students;
            console.log(`log type: report`, ` request body:`, requestBody);
            const token = await studentReportToken(requestBody);
            await axios.post(url, {
                token,
            });
            return true;
        }catch(e){
            console.log(`could not send userStatistics `);
            console.log(e);
        }
        this.client.publish(`DEL`, `K`);
        return true;
    }
    private async checkTempStorage () {
        const isTepmStorageLocked = RedisKeys.isTepmStorageLocked();
        const isLocked = await this.client.set(isTepmStorageLocked, `true`, `NX`);
        if (isLocked) {
            const tempStorageKeys = RedisKeys.tempStorageKeys();
            const pipeline = new Pipeline(this.client);
            let tempStorageSearchCursor = `0`;
            do {
                const [ newCursor, keys ] = await this.client.sscan(tempStorageKeys, tempStorageSearchCursor);

                for (const key of keys) {
                    const tempSingleKey = RedisKeys.tempStorageKey(key);
                    const tempSingleData = await this.client.get(tempSingleKey);
                    const currentTime = new Date();
                    const diffInSeconds = Number(tempSingleData) - Math.floor(currentTime.getTime());
                    if(diffInSeconds <= 0){
                        // trigger assessment then delete data from redis
                        await this.triggerLiveClassAssessment(key);
                        await pipeline.del(tempSingleKey);
                        await pipeline.srem(tempStorageKeys, key);
                    }
                }
                tempStorageSearchCursor = newCursor;
            } while (tempStorageSearchCursor !== `0`);

            await pipeline.exec();
        }

        await this.client.del(isTepmStorageLocked);
    }

    private async triggerLiveClassAssessment (roomId: string) {
        console.log(`TRIGGERING LIVE CLASS ASSESSMENT `, roomId);
        await this.sendAttendance(roomId, ClassType.LIVE);
    }
}

type Student = {
    user_id: string;
    email: string;
    name: string;
}

type RequestBody = {
    room_id: string;
    class_type: string;
    lesson_material_url: string;
    content_type: string;
    action_type: StudentReportActionType;
    timestamp: number;
    students: Student[];
}

type SFUEntry = {
    sfuAddress: string;
}
