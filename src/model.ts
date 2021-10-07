import { convertSessionRecordToSession, fromRedisKeyValueArray } from "./utils";
import { redisStreamDeserialize, redisStreamSerialize } from "./utils";
import { RedisKeys } from "./redisKeys";
import Redis = require("ioredis")
import { WhiteboardService } from "./services/whiteboard/WhiteboardService";
import { Context } from "./main";
import WebSocket = require("ws");
import { PageEvent, Session, StudentReport, StudentReportActionType, ClassType } from "./types";
import { Attendance } from "./entities/attendance";
import { getRepository } from "typeorm";
import axios from "axios";
import { attendanceToken, studentReportToken } from "./jwt";
import { Feedback, FeedbackType, QuickFeedback, QuickFeedbackType } from "./entities/feedback";
import { UserInputError } from "apollo-server";

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

    public async setHost(roomId: string, nextHostId: string) {
        if(!nextHostId) { throw new Error("Can't set the host without knowning the sessionId of the new host"); }
        
        const roomHostKey = RedisKeys.roomHost(roomId);
        const nextHostSessionKey = RedisKeys.sessionData(roomId, nextHostId);

        const previousHostId = await this.client.getset(roomHostKey.key, nextHostId);

        if(previousHostId === nextHostId) { return; } // The host has not changed

        const pipeline = this.client.pipeline()
            .hset(nextHostSessionKey, "isHost", "true")
            .expire(roomHostKey.key, roomHostKey.ttl);

        if(previousHostId) {
            const previousHostSessionKey = RedisKeys.sessionData(roomId, previousHostId);
            pipeline.hset(previousHostSessionKey, "isHost", "false");
        }

        await pipeline.exec();
        
        const join = await this.getSession(roomId, nextHostId);
        this.notifyRoom(roomId, { join }).catch((e) => console.log(e));

        if(previousHostId) {
            const join = await this.getSession(roomId, previousHostId);
            this.notifyRoom(roomId, { join }).catch((e) => console.log(e));
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
        // console.log('streamId: ', streamId);
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
        const id = await this.client.xadd(chatMessages.key, "MAXLEN", "~", 256, "*", "json", JSON.stringify({ session, message }));
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

    public async endClass(context: Context): Promise<boolean> {
        console.log("endClass: ", context?.token?.classtype);
        const {sessionId, token} = context;
        if (!token?.teacher) {
            console.log(`Session ${sessionId} attempted to end class!`);
            return false;
        }
        const pipeline = this.client.pipeline();

        // delete class host
        const roomHost = RedisKeys.roomHost(token.roomid);
        pipeline.del(roomHost.key);
        
        for await (const session of this.getSessions(token.roomid)) {
            const sessionKey = RedisKeys.sessionData(token.roomid, session.id);
            pipeline.del(sessionKey);
            await this.notifyRoom(token.roomid, { leave: session});
            await this.logAttendance(token.roomid, session);
        }
        await pipeline.exec();
        await this.sendAttendance(token.roomid);
        return true;
    }

    public async disconnect(context: Context | any) {
        console.log(`Disconnect: ${JSON.stringify(context.sessionId)}`);
        await this.userLeave(context);
        return true;
    }

    public async * room(context: Context, roomId: string, name?: string) {
        const { sessionId, websocket, token, authenticationToken } = context;
        if(!token) {throw new Error("Can't subscribe to a room without a token");}
        if(!sessionId) {throw new Error("Can't subscribe to a room without a sessionId");}
        if(!websocket) {throw new Error("Can't subscribe to a room without a websocket");}
        if(context.roomId) { console.error(`Session(${sessionId}) already subscribed to Room(${context.roomId}) and will now subscribe to Room(${roomId}) attendance records do not support multiple rooms`); }
        context.roomId = roomId;
        // TODO: Pipeline initial operations
        await this.userJoin(roomId, sessionId, token.userid, name ?? token.name, token.teacher, authenticationToken?.email);

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
        const sessions = [];
        for await (const session of this.getSessions(roomId)) {
            if(!session.id) { continue; }
            sessions.push(session);
        }
        const sortedSessions = sessions.sort((a: Session) => a.isHost ? -1 : 1);
        for (const session of sortedSessions) {
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
                // console.log(streamId, 'response');
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
        const activityType = message?.content?.type;
        if (activityType === "Activity" || activityType === "Stream") { //delete old Streams
            await this.deleteOldStreamId(roomId, activityType);
        }
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

    private async userJoin(roomId: string, sessionId: string, userId: string, name?: string, isTeacher?: boolean, email?: string) {
        const joinedAt = new Date().getTime();
        const sessionKey = RedisKeys.sessionData(roomId, sessionId);
        const roomHostKey = RedisKeys.roomHost(roomId);
        await this.client.pipeline()
            .hset(sessionKey, "id", sessionId)
            .hset(sessionKey, "name", name||"")
            .hset(sessionKey, "userId", userId)
            .hset(sessionKey, "joinedAt", joinedAt)
            .hset(sessionKey, "email", email||"")
            .hset(sessionKey, "isTeacher", Boolean(isTeacher).toString())
            .exec();

        if(isTeacher) {
            const becameHost = await this.client.set(roomHostKey.key, sessionId, "EX", roomHostKey.ttl, "NX");
            if(becameHost) { await this.client.hset(sessionKey, "isHost", "true"); }
        }

        const join = await this.getSession(roomId, sessionId);
        console.log("session: ", join);
        this.notifyRoom(roomId, { join });
    }

    private async findRooms(sessionId: string): Promise<Set<string>> {
        const rooms = new Set<string>();
        const sessionSearchKey = RedisKeys.sessionData("*", sessionId);
        let sessionSearchCursor = "0";
        
        do {
            const [newCursor, keys] = await this.client.scan(sessionSearchCursor, "MATCH", sessionSearchKey);
            for (const key of keys) {
                const params = RedisKeys.parseSessionDataKey(key);
                if (!params) { continue; }
                rooms.add(params.roomId);
            }
            sessionSearchCursor = newCursor;
        } while (sessionSearchCursor !== "0");
        
        return rooms;
    }

    private async userLeave(context: Context) {
        console.log("userLeft: ", context?.token?.classtype);
        const { sessionId } = context;
        if(!sessionId) { return; }
        const roomIds = await this.findRooms(sessionId);
        
        for await (const roomId of roomIds) {
            const roomHostKey = RedisKeys.roomHost(roomId);
            const roomHostId = await this.client.get(roomHostKey.key);
            const changeRoomHost = (roomHostId === sessionId);

            const pipeline = this.client.pipeline();

            if (changeRoomHost) { pipeline.del(roomHostKey.key); }

            //Get and delete session
            const sesionKey = RedisKeys.sessionData(roomId, sessionId);
            const session = await this.getSession(roomId, sessionId);
            pipeline.del(sesionKey);

            // Notify other participants that this user has left
            const notify = RedisKeys.roomNotify(roomId);
            pipeline.expire(notify.key, notify.ttl);
            pipeline.xadd(
                notify.key,
                "MAXLEN", "~", "64", "*",
                ...redisStreamSerialize({ leave: { id: sessionId } })
            );
            
            //Log Attendance
            await this.logAttendance(roomId, session);
            await pipeline.exec();

            //Select new host
            if (changeRoomHost) { 
                const teachers = await this.getRoomParticipants(roomId, true, true);
                if(teachers.length > 0){
                    const firstJoinedTeacher = teachers[0];
                    await this.setHost(roomId, firstJoinedTeacher.id);
                }
            } 
        }
        await this.attendanceNotify(roomIds);     

    }

    private async logAttendance(roomId: string, session: Session) {
        try {
            const attendance = new Attendance();
            attendance.sessionId = session.id;
            attendance.joinTimestamp = new Date(session.joinedAt);
            attendance.leaveTimestamp = new Date();
            attendance.roomId = roomId;
            attendance.userId = session.userId;
            await attendance.save();
            console.log("logAttendance", attendance);
        } catch(e) {
            console.log(`Unable to save attendance: ${JSON.stringify({session, leaveTime: Date.now()})}`);
            console.log(e);
        }
    }

    private async attendanceNotify(rooms: Set<string>) {
        nextRoom:
        for(const roomId of rooms) {
            const sessionSearchKey = RedisKeys.sessionData(roomId, "*");
            let sessionSearchCursor = "0";

            do {
                const [newCursor, keys] = await this.client.scan(sessionSearchCursor, "MATCH", sessionSearchKey);
                if(keys.length > 0) { continue nextRoom; }
                sessionSearchCursor = newCursor;
            } while (sessionSearchCursor !== "0");

            //There were no sessions in room
            //Maybe we need a timeout to check no one rejoins
            await this.sendAttendance(roomId);
        }

    }

    private async sendAttendance(roomId: string) {
        const url = process.env.ASSESSMENT_ENDPOINT;
        if(!url) {return;}
        try {
            const attendance = await getRepository(Attendance).find({ roomId });
            const attendance_ids = new Set([...attendance.map((a) => a.userId)]);
            const now = Number(new Date());
            const class_end_time_ms = Math.max(
                ...attendance.map((a) => Number(a.leaveTimestamp)),
                now,
            );
            const class_end_time = Math.round(class_end_time_ms / 1000);
            const class_start_time_ms = Math.min(
                ...attendance.map((a) => Number(a.joinTimestamp)),
                now,
            );
            const class_start_time = Math.round(class_start_time_ms / 1000);
            console.log("sendAttendance", {roomId, attendance_ids: [...attendance_ids], class_start_time, class_end_time});
            const token = await attendanceToken(roomId, [...attendance_ids], class_start_time, class_end_time);
            await axios.post(url, {token});
        } catch(e) {
            console.log("Unable to post attendance");
            // console.error(e);
        }
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

    public async saveFeedback(context: Context, stars: number, feedbackType: string, comment: string, quickFeedback: {type: string, stars: number}[]) {
        if(!context.token || !context.sessionId) { return; }
        const feedbackArray = [];
        for (const { type, stars } of quickFeedback) {
            const item = new QuickFeedback();
            const quickFeedbackType = Object.values(QuickFeedbackType).find((val: string) => val.toLowerCase() === type.toLowerCase());
            if (!quickFeedbackType) {
                throw new UserInputError(`invalid quick feedback type: ${type}`);
            }
            item.type = quickFeedbackType;
            item.stars = stars;
            feedbackArray.push(item);
        }

        try {
            const feedback = new Feedback();
            feedback.sessionId = context.sessionId;
            feedback.roomId = context.token.roomid;
            feedback.userId = context.token.userid;
            feedback.type = feedbackType === "END_CLASS" ? FeedbackType.EndClass : FeedbackType.LeaveClass;
            feedback.stars = stars;
            feedback.comment = comment;
            feedback.quickFeedback = feedbackArray;
            await feedback.save();
        } catch(e) {
            console.log(e);
        }
        return true;
    }

    private async getTime() {
        const [seconds, microseconds] = await this.client.time();
        return Number(seconds) + Number(microseconds) / 1e6;
    }

    public async getRoomParticipants(roomId: string, isTeacher = true,  sort = false){
        const sessions = [];
        for await (const session of this.getSessions(roomId)) {
            if(session.isTeacher === isTeacher) { sessions.push(session); }
        }
        if (sort) {
            sessions.sort((a: Session, b: Session) => a.joinedAt - b.joinedAt);
        }
        return sessions;
    }

    private async deleteOldStreamId(roomId: string, activityType: string) {
        
        const roomActivityTypeKey = RedisKeys.activityType(roomId);
        const roomActivityType = await this.client.get(roomActivityTypeKey.key);

        if(!roomActivityType) {
            await this.client.set(roomActivityTypeKey.key, activityType);
        }else{
            await this.client.set(roomActivityTypeKey.key, activityType);
            if(roomActivityType !== activityType){
                const studentSessions = await this.getRoomParticipants(roomId, false);
                for await (const studentSession of studentSessions) {
                    if (studentSession.streamId){
                        const studentSessionKey = RedisKeys.sessionData(roomId, studentSession.id);
                        await this.client
                            .hset(studentSessionKey, "streamId", "" );
                        
                        const session = await this.getSession(roomId, studentSession.id);
                        await this.notifyRoom(roomId, {join: session });   
                    }         
                }
            }

        }
    }

    public async studentReport(roomId: string, context: Context, materialUrl: string, activityTypeName:string){
        const url = process.env.STUDENT_REPORT_ENDPOINT;
        const classtype = context.token?.classtype;
        if(!url || !(materialUrl && activityTypeName && classtype)) return;

        try{
            const userStatisctics: StudentReport = {
                classType: classtype,
                lessonMaterialUrl: materialUrl,
                contentType: activityTypeName.toLowerCase(),
                actionType: StudentReportActionType.VIEWED
            };

            const studentSessions = await this.getRoomParticipants(roomId, false);
            const students: any = [];
            const recordedAt = new Date().getTime();
            const requestBody: any = {
                room_id: roomId,
                class_type: userStatisctics.classType,
                lesson_material_url: userStatisctics.lessonMaterialUrl,
                content_type: userStatisctics.contentType,
                action_type: userStatisctics.actionType,
                timestamp: recordedAt
            };
            for await (const session of studentSessions){
                const student: any = {};
                student["user_id"] = session.id;
                student["email"] = session.email;
                student["name"] = session.name;
                students.push(student);
            }   
            requestBody["students"] = students;
            console.log("log type: report", " request body:", requestBody);
            const token = await studentReportToken(requestBody);
            await axios.post(url, {token});
            return true;
        }catch(e){
            console.log("could not send userStatistics ");
            console.log(e);
        }
    }

}
