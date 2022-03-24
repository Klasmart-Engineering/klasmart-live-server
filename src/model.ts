import Redis from 'ioredis';
import {ClassService} from './services/class/ClassService';
import {FeedbackService} from './services/feedback/FeedbackService';
import {VideoServices} from './services/video/VideoServices';
import {WhiteboardService} from './services/whiteboard/WhiteboardService';
import {
  Context,
  PageEvent,
  Message,
} from './types';

export class Model {
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
    this.whiteboardService = new WhiteboardService(client);
    this.videoService = new VideoServices(client);
    this.feedbackService = new FeedbackService(client);
    this.classService = new ClassService(client);
  }

  /** classService begin */
  public setHost(context: Context, nextHostId: string): Promise<Boolean> {
    return this.classService.setHost(context, nextHostId);
  }

  public showContent(context: Context, type: string, contentId?: string): Promise<Boolean> {
    return this.classService.showContent(context, type, contentId);
  }

  public postPageEvent(streamId: string, pageEvents: PageEvent[]): Promise<Boolean> {
    return this.classService.postPageEvent(streamId, pageEvents);
  }

  public sendMessage(context: Context, message: string): Promise<Message|undefined> {
    return this.classService.sendMessage(context, message);
  }

  public mute(context: Context, sessionId: string, audio?: boolean, video?: boolean): Promise<boolean> {
    return this.classService.mute(context, sessionId, audio, video);
  }

  public async setSessionStreamId(context: Context, streamId: string): Promise<Boolean> {
    return this.classService.setSessionStreamId(context, streamId);
  }

  public endClass(context: Context): Promise<boolean> {
    return this.classService.endClass(context);
  }

  public leaveRoom(context: Context): Promise<boolean> {
    return this.classService.leaveRoom(context);
  }

  public joinRoom(context: Context, name?: string) {
    return this.classService.joinRoom(context, name);
  }

  public stream({websocket}: Context, streamId: string, from: string) {
    return this.classService.stream(websocket, streamId, from);
  }
  public studentReport(context: Context, materialUrl: string, activityTypeName: string): Promise<Boolean> {
    return this.classService.studentReport(context, materialUrl, activityTypeName);
  }

  public setClassAttendees(context: Context, userIds: [string]): Promise<Boolean> {
    return this.classService.setClassAttendees(context, userIds);
  }

  public getSfuAddress(context: Context): Promise<String|undefined> {
    return this.classService.getSfuAddress(context);
  }
  /** classService end */


  /** whiteboardService begin */
  public webRTCSignal(context: Context, toSessionId: string, webRTC: any): Promise<Boolean> {
    return this.classService.webRTCSignal(context, toSessionId, webRTC);
  }

  public whiteboardSendEvent(context: Context, event: string): Promise<boolean> {
    return this.whiteboardService.whiteboardSendEvent(context, event);
  }

  public whiteboardSendDisplay(context: Context, display: boolean): Promise<boolean> {
    return this.whiteboardService.whiteboardSendDisplay(context, display);
  }

  public whiteboardSendPermissions(context: Context, userId: string, permissions: string): Promise<boolean> {
    return this.whiteboardService.whiteboardSendPermissions(context, userId, permissions);
  }

  public whiteboardEvents(context: Context) {
    return this.whiteboardService.whiteboardEventStream(context);
  }

  public whiteboardState(context: Context) {
    return this.whiteboardService.whiteboardStateStream(context);
  }

  public whiteboardPermissions(context: Context, userId: string) {
    return this.whiteboardService.whiteboardPermissionsStream(context, userId);
  }
  /** whiteboardService end */


  /** videoService begin */
  public video(context: Context, sessionId: string, src?: string, play?: boolean, offset?: number): Promise<boolean> {
    return this.videoService.startVideoStream(context, sessionId, src, play, offset);
  }

  public videoSubscription(context: Context, sessionId: string) {
    return this.videoService.subscribeToVideo(context, sessionId);
  }
  /** videoService end */


  /** feedbackService begin */
  public rewardTrophy(context: Context, user: string, kind: string): Promise<boolean> {
    return this.feedbackService.rewardTrophy(context, user, kind);
  }

  public saveFeedback(context: Context, stars: number, feedbackType: string, comment: string, quickFeedback: {type: string; stars: number}[]) {
    return this.feedbackService.saveFeedback(context, stars, feedbackType, comment, quickFeedback);
  }
  /** feedbackService end */
}
