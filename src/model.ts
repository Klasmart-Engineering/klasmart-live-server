import Redis from 'ioredis';
import {Base} from './services/base';
import {ClassService} from './services/class/ClassService';
import {FeedbackService} from './services/feedback/FeedbackService';
import {VideoServices} from './services/video/VideoServices';
import {WhiteboardService} from './services/whiteboard/WhiteboardService';
import {
  Context,
  PageEvent,
  Message,
} from './types';

export class Model extends Base {
  private static async createClient() {
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

  public static async create() {
    const redis = await this.createClient();
    console.log(`🔴 Redis database connected`);
    return new Model(redis);
  }

  private whiteboardService: WhiteboardService;
  private videoService: VideoServices;
  private feedbackService: FeedbackService;
  private classService: ClassService;

  private constructor(client: Redis.Cluster | Redis.Redis) {
    super(client);
    this.whiteboardService = new WhiteboardService(client);
    this.videoService = new VideoServices(client);
    this.feedbackService = new FeedbackService(client);
    this.classService = new ClassService(client);
  }

  /** classService begin */
  public setHost(roomId: string, nextHostId: string): Promise<Boolean> {
    return this.classService.setHost(roomId, nextHostId);
  }

  public showContent(roomId: string, type: string, contentId?: string): Promise<Boolean> {
    return this.classService.showContent(roomId, type, contentId);
  }

  public postPageEvent(streamId: string, pageEvents: PageEvent[]): Promise<Boolean> {
    return this.classService.postPageEvent(streamId, pageEvents);
  }

  public sendMessage(roomId: string, sessionId: string | undefined, message: string): Promise<Message|undefined> {
    return this.classService.sendMessage(roomId, sessionId, message);
  }

  public mute(roomId: string, sessionId: string, audio?: boolean, video?: boolean): Promise<boolean> {
    return this.classService.mute(roomId, sessionId, audio, video);
  }

  public async setSessionStreamId(roomId: string, sessionId: string | undefined, streamId: string): Promise<Boolean> {
    return this.classService.setSessionStreamId(roomId, sessionId, streamId);
  }

  public endClass(context: Context): Promise<boolean> {
    return this.classService.endClass(context);
  }

  public leaveRoom(context: Context | any): Promise<boolean> {
    return this.classService.leaveRoom(context);
  }

  public joinRoom(context: Context, roomId: string, name?: string) {
    return this.classService.joinRoom(context, roomId, name);
  }

  public stream({websocket}: Context, streamId: string, from: string) {
    return this.classService.stream(websocket, streamId, from);
  }
  public studentReport(roomId: string, context: Context, materialUrl: string, activityTypeName: string): Promise<Boolean> {
    return this.classService.studentReport(roomId, context, materialUrl, activityTypeName);
  }

  public setClassAttendees(roomId: string, userIds: [string]): Promise<Boolean> {
    return this.classService.setClassAttendees(roomId, userIds);
  }

  public getSfuAddress(roomId: string): Promise<String|undefined> {
    return this.classService.getSfuAddress(roomId);
  }
  /** classService end */


  /** whiteboardService begin */
  public webRTCSignal(roomId: string, toSessionId: string, sessionId: string | undefined, webRTC: any): Promise<Boolean> {
    return this.classService.webRTCSignal(roomId, toSessionId, sessionId, webRTC);
  }

  public whiteboardSendEvent(roomId: string, event: string): Promise<boolean> {
    return this.whiteboardService.whiteboardSendEvent(roomId, event);
  }

  public whiteboardSendDisplay(roomId: string, display: boolean): Promise<boolean> {
    return this.whiteboardService.whiteboardSendDisplay(roomId, display);
  }

  public whiteboardSendPermissions(roomId: string, userId: string, permissions: string): Promise<boolean> {
    return this.whiteboardService.whiteboardSendPermissions(roomId, userId, permissions);
  }

  public whiteboardEvents(context: Context, roomId: string) {
    return this.whiteboardService.whiteboardEventStream(context, roomId);
  }

  public whiteboardState(context: Context, roomId: string) {
    return this.whiteboardService.whiteboardStateStream(context, roomId);
  }

  public whiteboardPermissions(context: Context, roomId: string, userId: string) {
    return this.whiteboardService.whiteboardPermissionsStream(context, roomId, userId);
  }
  /** whiteboardService end */


  /** videoService begin */
  public video(roomId: string, sessionId: string, src?: string, play?: boolean, offset?: number): Promise<boolean> {
    return this.videoService.startVideoStream(roomId, sessionId, src, play, offset);
  }

  public videoSubscription({websocket}: Context, roomId: string, sessionId: string) {
    return this.videoService.subscribeToVideo(websocket, roomId, sessionId);
  }
  /** videoService end */


  /** feedbackService begin */
  public async rewardTrophy(roomId: string, user: string, kind: string, sessionId?: string): Promise<boolean> {
    this.feedbackService.rewardTrophy(roomId, user, kind, sessionId);
    return true;
  }

  public async saveFeedback(context: Context, stars: number, feedbackType: string, comment: string, quickFeedback: {type: string; stars: number}[]) {
    this.feedbackService.saveFeedback(context, stars, feedbackType, comment, quickFeedback);
    return true;
  }
  /** feedbackService end */
}
