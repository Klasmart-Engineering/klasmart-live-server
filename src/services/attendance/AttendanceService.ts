import Redis from "ioredis";
import { Cluster } from "ioredis";
import request from "graphql-request";
import axios from "axios";
import {
    SAVE_ATTENDANCE_MUTATION,
    SEND_ATTENDANCE_MUTAION,
    SCHEDULE_ATTENDANCE_MUTATION,
} from "../../graphql";
import {
    Session, ClassType, AttendanceRequestType
} from "../../types";
import {Base} from "../base";
import { generateToken } from "../../jwt";

export class AttendanceService extends Base {
    constructor(readonly client: Cluster | Redis) {
        super(client);
    }

    public async log(roomId: string, session: Session): Promise<boolean> {
        const url = process.env.ATTENDANCE_SERVICE_ENDPOINT;
        const roomContext = await this.getRoomContext(roomId);
        if (!url || !roomContext || !session.id) return false;
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

        return true;
    }

    public async send(roomId: string): Promise<boolean> {
        const url = process.env.ATTENDANCE_SERVICE_ENDPOINT;
        const roomContext = await this.getRoomContext(roomId);
        if (!url || !roomContext) {
            return false;
        }
        const variables = {
            roomId: roomId
        };
        await request(url, SEND_ATTENDANCE_MUTAION, variables).then((data) => {
            const attendance = data.saveAttendance;
            console.log("attendance sent: ", attendance);
        }).catch((e) => {
            console.log("could not send attendance: ", e);
        });
        return true;
    }

    public async schedule(roomId: string): Promise<boolean> {
        const url = process.env.ATTENDANCE_SERVICE_ENDPOINT;
        const roomContext = await this.getRoomContext(roomId);
        if (!url || !roomContext) return false;
        const variables = {
            roomId: roomId
        };
        await request(url, SCHEDULE_ATTENDANCE_MUTATION, variables).then((data) => {
            const attendance = data.saveAttendance;
            console.log("attendance scheduled: ", attendance);
        }).catch((e) => {
            console.log("could not schedule attendance: ", e);
        });

        return true;
    }

    public async sendClassStatus(roomId: string, userId: string): Promise<boolean> {
        const assessmentUrl = process.env.ASSESSMENT_ENDPOINT;
        if (!assessmentUrl) {
            return false;
        }
        const roomContext = await this.getRoomContext(roomId);
        if (roomContext.classType !== ClassType.LIVE 
            && roomContext.classType !== ClassType.STUDY) {
            return false;
        }
        try{
            const body: AttendanceRequestType = {
                action: "EnterLiveRoom",
                attendance_ids: [userId],
                class_end_time: 0,
                class_length: 0,
                schedule_id: roomId,
            };
            const token = await generateToken(body);
            await axios.post(assessmentUrl, {
                token,
            });
            console.log("sendClassStatus DONE!");
        }catch(e) {
            console.log("could not send action of user to assessment service");
        }
        return true;
    }
}

