
import {Pipeline} from '../pipeline';
import {RedisKeys} from '../redisKeys';
import {
  Context,
  RoomContext,
  Session,
} from '../types';
import {
  convertSessionRecordToSession,
  redisStreamSerialize,
} from '../utils';
import Redis from 'ioredis';

export class Base {
  constructor(readonly client: Redis.Redis | Redis.Cluster) {}

  public async setRoomContext(context: Context) {
    const roomId = context.roomId;
    if (roomId) {
      const roomContextKey = RedisKeys.roomContext(roomId);
      await this.client.hset(roomContextKey, `classtype`, context.authorizationToken?.classtype || ``);
      await this.client.hset(roomContextKey, `startat`, context.authorizationToken?.startat || ``);
      await this.client.hset(roomContextKey, `endat`, context.authorizationToken?.endat || ``);
    }
  }

  public async getRoomContext(roomId: string): Promise<RoomContext> {
    const roomContextKey = RedisKeys.roomContext(roomId);
    const roomContext = await this.client.hgetall(roomContextKey);
    return {
      classType: roomContext.classtype,
      startAt: Number(roomContext.startat),
      endAt: Number(roomContext.endat),
    } as RoomContext;
  }

  public async* getSessions(roomId: string) {
    const roomSessionsKey = RedisKeys.roomSessions(roomId);
    let sessionSearchCursor = `0`;
    do {
      const [newCursor, keys] = await this.client.sscan(roomSessionsKey, sessionSearchCursor);
      const pipeline = new Pipeline(this.client);
      for (const key of keys) {
        await pipeline.hgetall(key);
      }
      const sessions = await pipeline.exec();
      for (const [, session] of sessions) {
        yield convertSessionRecordToSession(session);
      }
      sessionSearchCursor = newCursor;
    } while (sessionSearchCursor !== `0`);
  }

  public async getSession(roomId: string, sessionId: string): Promise<Session> {
    const sessionKey = RedisKeys.sessionData(roomId, sessionId);
    const sessionRecord = await this.client.hgetall(sessionKey);
    return convertSessionRecordToSession(sessionRecord);
  }

  public async notifyRoom(roomId: string, message: any): Promise<string> {
    const activityType = message?.content?.type;
    if (activityType === `Activity` || activityType === `Stream`) { // delete old Streams
      await this.deleteOldStreamId(roomId, activityType);
    }
    const notify = RedisKeys.roomNotify(roomId);
    await this.client.expire(notify.key, notify.ttl);
    const res = await this.client.xadd(notify.key, `MAXLEN`, `~`, 32, `*`, ...redisStreamSerialize(message));
    return res;
  }

  public async notifySession(roomId: string, sessionId: string, message: any): Promise<string> {
    const notifyKey = RedisKeys.sessionNotify(roomId, sessionId);
    const res = await this.client.xadd(notifyKey, `MAXLEN`, `~`, 32, `*`, ...redisStreamSerialize(message));
    return res;
  }

  public async getTime() {
    const [seconds, microseconds] = await this.client.time();
    return Number(seconds) + Number(microseconds) / 1e6;
  }

  public async getRoomParticipants(roomId: string, isTeacher = true, sort = false) {
    const sessions = [];
    for await (const session of this.getSessions(roomId)) {
      if (session.isTeacher === isTeacher) {
        sessions.push(session);
      }
    }
    if (sort) {
      sessions.sort((a: Session, b: Session) => a.joinedAt - b.joinedAt);
    }
    return sessions;
  }

  private async deleteOldStreamId(roomId: string, activityType: string) {
    const roomActivityTypeKey = RedisKeys.activityType(roomId);
    const roomActivityType = await this.client.get(roomActivityTypeKey.key);

    if (!roomActivityType) {
      await this.client.set(roomActivityTypeKey.key, activityType);
    } else {
      await this.client.set(roomActivityTypeKey.key, activityType);
      if (roomActivityType !== activityType) {
        const studentSessions = await this.getRoomParticipants(roomId, false);
        for await (const studentSession of studentSessions) {
          if (studentSession.streamId) {
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
}
