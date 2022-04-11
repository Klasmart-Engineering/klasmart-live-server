import {
  GET_ATTENDANCE_QUERY,
  SAVE_ATTENDANCE_MUTATION,
} from '../../graphql';
import {generateToken} from '../../jwt';
import {
  Attendance,
  ClassType,
  Session,
  AttendanceRequestType,
} from '../../types';
import {RedisKeys} from '../../redisKeys';
import {Base} from '../base';
import axios from 'axios';
import request from 'graphql-request';
import Redis from 'ioredis';

export class AttendanceService extends Base {
  constructor(readonly client: Redis.Cluster | Redis.Redis) {
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
      console.log(`saved attendance: `, attendance);
    }).catch((e) => {
      console.log(`could not save attendance: `, e);
    });
  }

  public async send(roomId: string) {
    const roomContext = await this.getRoomContext(roomId);
    this.sendAttendance(roomId);
    if (roomContext.classType === ClassType.CLASS) {
      this.sendClassAttendance(roomId);
    } 
  }

  private async sendAttendance(roomId: string) {
    const assessmentUrl = process.env.ASSESSMENT_ENDPOINT;
    const attendanceUrl = process.env.ATTENDANCE_SERVICE_ENDPOINT;
    if (!assessmentUrl || !attendanceUrl) {
      return;
    }
    // log attendance if class onging after 2 hours its end_time
    const url = process.env.ATTENDANCE_SERVICE_ENDPOINT;
    if (url) {
      for await (const session of this.getSessions(roomId)) {
        this.log(roomId, session);
      }
    }

    try {
      let attendances: Attendance [] = [];

      await request(attendanceUrl, GET_ATTENDANCE_QUERY, {
        roomId: roomId,
      }).then((data: any) => {
        attendances = data.getClassAttendance;
        console.log(`received attendance: `, attendances);
      }).catch((e) => {
        console.log(`could not get attendance: `, e);
      });

      const attendanceIds = new Set([...attendances.map((a) => a.userId)]);

      let numberOfTeachers = 0;
      let numberOfStudents = 0;
      [...attendanceIds].map((a) => {
        for ( const attendance of attendances) {
          if (a === attendance.userId) {
            if (attendance.isTeacher) {
              numberOfTeachers += 1;
            } else {
              numberOfStudents += 1;
            }
            break;
          }
        }
      });
      // in live class to trigger attendance there should be at least
      // on teacher an on student
      const roomContext = await this.getRoomContext(roomId);
      if (roomContext.classType === ClassType.LIVE && (numberOfTeachers === 0 || numberOfStudents === 0)) {
        return;
      }
      const body: AttendanceRequestType = {
        attendance_ids: [...attendanceIds],
        class_end_time: roomContext.endAt,
        class_length: roomContext.endAt-roomContext.startAt,
        schedule_id: roomId,
      };
      const token = await generateToken(body);
      await axios.post(assessmentUrl, {
        token,
      });
      console.log(`Attendance sent: `, roomId);
    } catch (e) {
      console.log(`Unable to post attendance: `, roomId);
      console.error(e);
    }
  }


  private async sendClassAttendance(roomId: string) {
    const key = RedisKeys.classAttendees(roomId);
    const response = await this.client.get(key);
    console.log('classAttendees added: ',roomId, response);
    if (response) {
      const assessmentUrl = process.env.ASSESSMENT_ENDPOINT;
      if (!assessmentUrl) return;
      const attendanceIds = response.split(`,`);
      console.log(`classAttendees attendanceIds: `, attendanceIds);
      const roomContext = await this.getRoomContext(roomId);
      const requestBody: AttendanceRequestType = {
        attendance_ids: [...attendanceIds],
        class_end_time: roomContext.endAt,
        class_length: roomContext.endAt-roomContext.startAt,
        schedule_id: roomId,
      };
      const token = await generateToken(requestBody);
      await axios.post(assessmentUrl, {
        token,
      });
      console.log(`classAttendees sent: `, roomId);
    }
    await this.client.del(key);
  }
}

