import {Base} from "../base";
import Redis from "ioredis";
import {RedisKeys} from "../../redisKeys";
import {Context, PageEvent, Session, SFUEntry, Message, StudentReportActionType, StudentReportRequestType, Student, StudentReport, ClassType} from "../../types";
import WebSocket from "ws";
import {Pipeline} from "../../pipeline";
import axios from "axios";
import {generateToken} from "../../jwt";
import {
    fromRedisKeyValueArray,
    redisStreamDeserialize,
    redisStreamSerialize,
} from "../../utils";

import {AttendanceService} from "../attendance/AttendanceService";
import {SchedulerService} from "../scheduler/SchedulerService";
import {WhiteboardService} from "../whiteboard/WhiteboardService";

export class ClassService extends Base {
    private attendanceService: AttendanceService;
    private schedulerService: SchedulerService;
    private whiteboardService: WhiteboardService;

    constructor(readonly client: Redis.Cluster | Redis.Redis) {
        super(client);
        this.attendanceService = new AttendanceService(client);
        this.schedulerService = new SchedulerService(client);
        this.whiteboardService = new WhiteboardService(client);
    }

    public async setHost(context: Context, nextHostId: string): Promise<boolean> {
        const roomId = context.authorizationToken.roomid;

        if (!nextHostId) {
            throw new Error("Can't set the host without knowing the sessionId of the new host");
        }

        const roomHostKey = RedisKeys.roomHost(roomId);
        const nextHostSessionKey = RedisKeys.sessionData(roomId, nextHostId);

        const previousHostId = await this.client.getset(roomHostKey.key, nextHostId);

        if (previousHostId === nextHostId) {
            return true;
        } // The host has not changed

        const pipeline = new Pipeline(this.client);
        await pipeline.hset(nextHostSessionKey, "isHost", "true");
        await pipeline.expire(roomHostKey.key, roomHostKey.ttl);

        if (previousHostId) {
            const previousHostSessionKey = RedisKeys.sessionData(roomId, previousHostId);
            await pipeline.hset(previousHostSessionKey, "isHost", "false");
        }
        await pipeline.exec();

        // room host is changed, reset Whiteboard permissions
        await this.whiteboardService.resetRoomPermissions(context);
        const join = await this.getSession(roomId, nextHostId);
        this.notifyRoom(roomId, {
            join,
        }).catch((e) => console.log(e));

        if (previousHostId) {
            const join = await this.getSession(roomId, previousHostId);
            this.notifyRoom(roomId, {
                join,
            }).catch((e) => console.log(e));
        }
        return true;
    }

    public async showContent(context: Context, type: string, contentId?: string): Promise<boolean> {
        const roomId = context.authorizationToken.roomid;
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
        return true;
    }

    public async postPageEvent(streamId: string, pageEvents: PageEvent[]): Promise<boolean> {
        const key = RedisKeys.streamEvents(streamId);
        const pipeline = new Pipeline(this.client);
        const lastkKeyframeKey = RedisKeys.lastKeyframe(streamId);
        let keyframeExist = false;
        // check if pageEvents has keyframe
        for (const {isKeyframe} of pageEvents) {
            if (isKeyframe) {
                keyframeExist = true;
            }
        }

        if (keyframeExist) {
            let prevResult = undefined;
            for (const {
                eventsSinceKeyframe, isKeyframe, eventData,
            } of pageEvents) {
                const result = await this.client.xadd(key, "MAXLEN", "~", (eventsSinceKeyframe + 1).toString(), "*", "i", eventsSinceKeyframe.toString(), "c", isKeyframe.toString(), "e", eventData);
                await this.client.expire(key, 60);
                if (isKeyframe && prevResult) {
                    await this.client.set(lastkKeyframeKey, prevResult);
                }
                prevResult = result;
            }
            return true;
        } else {
            for (const {
                eventsSinceKeyframe, isKeyframe, eventData,
            } of pageEvents) {
                await pipeline.xadd(key, "MAXLEN", "~", (eventsSinceKeyframe + 1).toString(), "*", "i", eventsSinceKeyframe.toString(), "c", isKeyframe.toString(), "e", eventData);
            }
            await pipeline.expire(key, 60);
            if (process.env.REDIS_MODE !== "CLUSTER") {
                const result = await pipeline.exec();
                return result.every(([e]) => e == null);
            } else {
                return true;
            }
        }
    }

    public async sendMessage(context: Context, message: string): Promise<Message|undefined> {
        const roomId = context.authorizationToken.roomid;
        const { sessionId } = context;

        if (!sessionId) {
            throw new Error("Can't reward trophy without knowing the sessionId it was from");
        }
        message = message.trim();
        if (message.length > 1024) {
            message = `${message.slice(0, 1024).trim()}...`;
        }
        if (!message) {
            return;
        }
        // TODO: Pipeline these operations
        const chatMessages = RedisKeys.roomMessages(roomId);
        const session = await this.getSession(roomId, sessionId);
        await this.client.expire(chatMessages.key, chatMessages.ttl);
        const id = await this.client.xadd(chatMessages.key, "MAXLEN", "~", 256, "*", "json", JSON.stringify({
            session,
            message,
        }));
        return {
            id,
            session,
            message,
        };
    }

    public async webRTCSignal(context: Context, toSessionId: string, webRTC: any): Promise<boolean> {
        const roomId = context.authorizationToken.roomid;
        const { sessionId } = context;
    
        if (!sessionId) {
            throw new Error("Can't send webrtc signal without knowing the sessionId it was from");
        }
        await this.notifySession(roomId, toSessionId, {
            webRTC: {
                sessionId,
                ...webRTC,
            },
        });
        return true;
    }

    public async mute(context: Context, sessionId: string, audio?: boolean, video?: boolean): Promise<boolean> {
        const roomId = context.authorizationToken.roomid;
        await this.notifyRoom(roomId, {
            mute: {
                sessionId,
                audio,
                video,
            },
        });
        return true;
    }

    public async endClass(context: Context): Promise<boolean> {
        console.log("endClass: ", context.authorizationToken.roomid);
        const {sessionId, authorizationToken} = context;
        // TODO: we should give permission to endClass
        // for a student who is in Study class
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
            await this.attendanceService.log(roomId, session);
        }

        await pipeline.exec();
        // when teacher end class trigger attendanceService
        await this.attendanceService.send(authorizationToken.roomid);

        return true;
    }

    public async leaveRoom(context: Context): Promise<boolean> {
        console.log(`Disconnect: ${JSON.stringify(context.sessionId)}`);
        console.log("userLeft: ", context?.authorizationToken?.classtype);
        this.decreaseCounter(context.websocket.protocol);
    
        const {sessionId} = context;
        const roomId = context?.authorizationToken?.roomid;
        if (sessionId === undefined || roomId === undefined) {
            return false;
        }

        const roomHostKey = RedisKeys.roomHost(roomId);
        const roomSessions = RedisKeys.roomSessions(roomId);
        const sessionKey = RedisKeys.sessionData(roomId, sessionId);
        const roomHostId = await this.client.get(roomHostKey.key);
        const changeRoomHost = (roomHostId === sessionId);

        // If using Redis in cluster mode, a pipeline requires all operations to be performed on the
        // same node, otherwise you will get an error.  This keeps compatibility with using node mode.
        const pipeline = new Pipeline(this.client);

        if (changeRoomHost) {
            await pipeline.del(roomHostKey.key);
        }

        // Get and delete session
        const session = await this.getSession(roomId, sessionId);
        await pipeline.srem(roomSessions, sessionKey);
        await pipeline.del(sessionKey);

        // Notify other participants that this user has left
        const notify = RedisKeys.roomNotify(roomId);
        await pipeline.expire(notify.key, notify.ttl);
        await pipeline.xadd(notify.key, "MAXLEN", "~", "64", "*", ...redisStreamSerialize({
            leave: {
                id: sessionId,
            },
        }));

    
        // Log Attendance
        await this.attendanceService.log(roomId, session);
        await pipeline.exec();
        if (context.authorizationToken.classtype === ClassType.STUDY) {
            await this.attendanceService.send(roomId);
        }
        // Select new host
        if (changeRoomHost) {
            const teachers = await this.getRoomParticipants(roomId, true, true);
            // room host is changed, reset Whiteboard permissions
            await this.whiteboardService.resetRoomPermissions(context);
      
            if (teachers.length > 0) {
                const firstJoinedTeacher = teachers[0];
                await this.setHost(context, firstJoinedTeacher.id);
            }
        }
        return true;
    }

    public async* joinRoom(context: Context, name?: string) {
        const {
            sessionId,
            websocket,
            authorizationToken,
            authenticationToken,
        } = context;
        const roomId = authorizationToken.roomid;
        if (!sessionId) {
            throw new Error("Can't subscribe to a room without a sessionId");
        }
        if (!websocket) {
            throw new Error("Can't subscribe to a room without a websocket");
        }
        if (context.roomId) {
            console.error(`Session(${sessionId}) already subscribed to Room(${context.roomId}) and will now subscribe to Room(${roomId}) attendanceService records do not support multiple rooms`);
        }
        context.roomId = roomId;
        // TODO: Pipeline initial operations
        await this.userJoin(roomId, sessionId, authorizationToken.userid, websocket.protocol, name ?? authorizationToken.name, authorizationToken.teacher, authenticationToken?.email);
        await this.setRoomContext(context);

        // start scheduler for class
        this.schedulerService.addSchedule(roomId);

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
                            type: "Blank",
                        },
                    },
                };
            }
        } catch (e) {
            yield {
                room: {
                    content: {
                        type: "Blank",
                    },
                },
            };
        }

        // Get all the sessions within a room
        const sessions = [];
        for await (const session of this.getSessions(roomId)) {
            if (!session.id) {
                continue;
            }
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
                await client.expire(chatMessages.key, chatMessages.ttl);
                await client.expire(notify.key, notify.ttl);
                const responses = await client.xread("BLOCK", 10000, "STREAMS", chatMessages.key, notify.key, sessionNotifyKey, lastMessageIndex, lastNotifyIndex, lastSessionNotifyIndex);
                if (!responses) {
                    continue;
                }

                for (const [key, response] of responses) {
                    switch (key) {
                    case notify.key:
                        for (const [id, keyValues] of response) {
                            lastNotifyIndex = id;
                            yield {
                                room: {
                                    ...redisStreamDeserialize<any>(keyValues),
                                },
                            };
                        }
                        break;
                    case chatMessages.key:

                        for (const [id, keyValues] of response) {
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
                        for (const [id, keyValues] of response) {
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
        } finally {
            client.disconnect();
        }
    }

    public async* stream( websocket: WebSocket|undefined, streamId: string, from: string) {
        if (!websocket) {
            throw new Error("Can't subscribe to a stream without a websocket");
        }
        const key = RedisKeys.streamEvents(streamId);
        if (!from) {
            const lastKeyframeKey = RedisKeys.lastKeyframe(streamId);
            const lastKeyframe = await this.client.get(lastKeyframeKey);
            if (lastKeyframe) {
                from = lastKeyframe;
            } else {
                from = "0";
            }
        }
        const client = this.client.duplicate(); // We will block
        try {
            while (websocket.readyState === WebSocket.OPEN) {
                await client.expire(key, 60 * 5);
                const response = await client.xread("BLOCK", 10000, "STREAMS", key, from);
                // console.log(streamId, 'response');
                if (!response) {
                    continue;
                }
                const [[, messages]] = response;
                for (const [id, keyValues] of messages) {
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
        } catch (e) {
            console.error(e);
        } finally {
            client.disconnect();
        }
    }

    private async userJoin(roomId: string, sessionId: string, userId: string, connectionType: string, name?: string, isTeacher?: boolean, email?: string) {
        const joinedAt = new Date().getTime();
        const sessionKey = RedisKeys.sessionData(roomId, sessionId);
        const roomSessions = RedisKeys.roomSessions(roomId);
        const roomHostKey = RedisKeys.roomHost(roomId);
        const pipeline = new Pipeline(this.client);

        await pipeline.hset(sessionKey, "id", sessionId);
        await pipeline.hset(sessionKey, "name", name || "");
        await pipeline.hset(sessionKey, "userId", userId);
        await pipeline.hset(sessionKey, "joinedAt", joinedAt);
        await pipeline.hset(sessionKey, "email", email||"");
        await pipeline.hset(sessionKey, "isTeacher", Boolean(isTeacher).toString());
        await pipeline.sadd(roomSessions, sessionKey);
        await pipeline.exec();

        if (isTeacher) {
            const becameHost = await this.client.set(roomHostKey.key, sessionId, "EX", roomHostKey.ttl, "NX");
            if (becameHost) {
                await this.client.hset(sessionKey, "isHost", "true");
            }
        }

        const join = await this.getSession(roomId, sessionId);
        console.log("session: ", join);
        await this.notifyRoom(roomId, {
            join,
        });
        this.increaseCounter(connectionType);
    }


    public async setSessionStreamId(context: Context, streamId: string): Promise<boolean> {
        const roomId = context.authorizationToken.roomid;
        const { sessionId } = context;

        if (!sessionId) {
            throw new Error("Can't setSessionStreamId without knowing the sessionId it was from");
        }
        const sessionKey = RedisKeys.sessionData(roomId, sessionId);
        const pipeline = new Pipeline(this.client);
        await pipeline.hset(sessionKey, "id", sessionId);
        await pipeline.hset(sessionKey, "streamId", streamId);
        await pipeline.exec();

        const session = await this.getSession(roomId, sessionId);
        await this.notifyRoom(roomId, {
            join: session,
        });
        return true;
    }

    public async studentReport(context: Context, materialUrl: string, activityTypeName: string): Promise<boolean> {

        const url = process.env.STUDENT_REPORT_ENDPOINT;
        const classtype = context.authorizationToken?.classtype;
        if (!url || !(materialUrl && activityTypeName && classtype)) return false;

        try {
            const userStatistics: StudentReport = {
                classType: classtype,
                lessonMaterialUrl: materialUrl,
                contentType: activityTypeName.toLowerCase(),
                actionType: StudentReportActionType.VIEWED,
            };
            const roomId = context.authorizationToken.roomid;
            const studentSessions = await this.getRoomParticipants(roomId, false);
            const students: Student[] = [];
            const recordedAt = new Date().getTime();
            const requestBody: StudentReportRequestType = {
                room_id: roomId,
                class_type: userStatistics.classType,
                lesson_material_url: userStatistics.lessonMaterialUrl,
                content_type: userStatistics.contentType,
                action_type: userStatistics.actionType,
                timestamp: recordedAt,
                students: [],
            };
            for await (const session of studentSessions) {
                const student: Student = {
                    user_id: session.userId,
                    email: session.email,
                    name: session.name,
                };
                students.push(student);
            }
            requestBody.students = students;
            console.log("log type: report", " request body:", requestBody);
            const token = await generateToken(requestBody);
            await axios.post(url, {
                token,
            });
            return true;
        } catch (e) {
            console.log("could not send userStatistics ");
            // console.log(e);
        }
        return true;
    }

    public async setClassAttendees(context: Context, userIds: [string]): Promise<boolean> {
        const roomId = context.authorizationToken.roomid;
        const classContext = await this.getRoomContext(roomId);
        console.log("classAttendees: ",roomId, userIds);
        if (classContext.classType === ClassType.CLASS) {
            this.schedulerService.addSchedule(roomId);
            const key = RedisKeys.classAttendees(roomId);
            await this.client.del(key);
            await this.client.set(key, userIds.toString());
            console.log("classAttendees added: ",roomId);
        }
        return true;
    }

    public async getSfuAddress(context: Context): Promise<string|undefined> {
        const roomId = context.authorizationToken.roomid;
    
        const sfu = RedisKeys.roomSfu(roomId);
        const address = await this.client.get(sfu.key);
        if (address) {
            return address;
        }

        const notify = RedisKeys.roomNotify(roomId);
        let lastNotifyIndex = "$";
        const endTime = Date.now() + 15 * 1000;
        while (Date.now() < endTime) {
            const responses = await this.client.xread("BLOCK", 15, "STREAMS", notify.key, lastNotifyIndex);
            if (!responses) {
                continue;
            }
            for (const [, response] of responses) {
                for (const [id, keyValues] of response) {
                    lastNotifyIndex = id;
                    const {sfuAddress} = redisStreamDeserialize<SFUEntry>(keyValues) as SFUEntry;
                    if (sfuAddress) {
                        return sfuAddress;
                    }
                }
            }
        }
        return undefined;
    }
}
