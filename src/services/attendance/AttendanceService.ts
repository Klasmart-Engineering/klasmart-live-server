import Redis from "ioredis";
import { Cluster } from "ioredis";
import request from "graphql-request";
import {
    SAVE_ATTENDANCE_MUTATION,
    SEND_ATTENDANCE_MUTAION,
    SCHEDULE_ATTENDANCE_MUTATION,
} from "../../graphql";
import {
    Session,
} from "../../types";
import {Base} from "../base";

export class AttendanceService extends Base {
    constructor(readonly client: Cluster | Redis) {
        super(client);
    }

    public async log(roomId: string, session: Session) {
        const url = process.env.ATTENDANCE_SERVICE_ENDPOINT;
        const roomContext = await this.getRoomContext(roomId);
        if (!url || !roomContext || !session.id) return;
        const variables = {
            roomId: roomId,
            sessionId: session.id,
            userId: session.userId,
            isTeacher: session.isTeacher,
            joinTimestamp: new Date(session.joinedAt),
            leaveTimestamp: new Date(),
        };

        await request(url, SAVE_ATTENDANCE_MUTATION, variables).then((data) => {
            const attendance = data.saveAttendance;
            console.log("attendance saved: ", attendance);
        }).catch((e) => {
            console.log("could not save attendance: ", e);
        });
    }

    public async send(roomId: string) {
        const url = process.env.ATTENDANCE_SERVICE_ENDPOINT;
        const roomContext = await this.getRoomContext(roomId);
        if (!url || !roomContext) return;
        const variables = {
            roomId: roomId
        };
        await request(url, SEND_ATTENDANCE_MUTAION, variables).then((data) => {
            const attendance = data.saveAttendance;
            console.log("attendance sent: ", attendance);
        }).catch((e) => {
            console.log("could not send attendance: ", e);
        });
    }

    public async schedule(roomId: string) {
        const url = process.env.ATTENDANCE_SERVICE_ENDPOINT;
        const roomContext = await this.getRoomContext(roomId);
        if (!url || !roomContext) return;
        const variables = {
            roomId: roomId
        };
        await request(url, SCHEDULE_ATTENDANCE_MUTATION, variables).then((data) => {
            const attendance = data.saveAttendance;
            console.log("attendance scheduled: ", attendance);
        }).catch((e) => {
            console.log("could not schedule attendance: ", e);
        });
    }
}

