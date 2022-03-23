import {model} from './main';
import {
  Context,
  PageEvent,
} from './types';
import {resolvers as resolver} from 'graphql-scalars';

export const resolvers = {
  ...resolver,
  Query: {
    ready: () => true,
    token: (parent: any, args: any, {authorizationToken}: Context) => ({
      subject: authorizationToken?.sub,
      audience: authorizationToken?.aud,
      userId: authorizationToken?.userid,
      userName: authorizationToken?.name,
      isTeacher: authorizationToken?.teacher,
      roomId: authorizationToken?.roomid,
      materials: authorizationToken?.materials,
      classType: authorizationToken?.classtype,
    }),
    sfuAddress: (parent: any, {roomId}: {roomId: string }, context: Context) => model.getSfuAddress(context),
  },
  Mutation: {
    endClass: (parent: any, arg: any, context: Context) => model.endClass(context),
    leaveClass: (parent: any, arg: any, context: Context) => model.leaveRoom(context, undefined),
    setSessionStreamId: (parent: any, {roomId, streamId}: {roomId: string; streamId: string}, context: Context) => model.setSessionStreamId(context, streamId),
    setHost: (parent: any, {roomId, nextHostId}: { roomId: string; nextHostId: string}, context: Context) => model.setHost(context, nextHostId),
    sendMessage: (parent: any, {roomId, message}: { roomId: string; message: string }, context: Context) => model.sendMessage(context, message),
    postPageEvent: (parent: any, {streamId, pageEvents}: { streamId: string; pageEvents: PageEvent[] }) => {
      const a = model.postPageEvent(streamId, pageEvents).catch((e) => e);
      return a;
    },
    showContent: (parent: any, {
      roomId, type, contentId,
    }: { roomId: string; type: string; contentId?: string }, context: Context) => model.showContent(context, type, contentId),
    webRTCSignal: (parent: any, {
      roomId, toSessionId, webrtc,
    }: {roomId: string; toSessionId: string; webrtc: any}, context: Context) => model.webRTCSignal(context, toSessionId, webrtc),
    whiteboardSendEvent: (parent: any, {roomId, event}: {roomId: string; event: string}, context: Context) => model.whiteboardSendEvent(context, event),
    whiteboardSendDisplay: (parent: any, {roomId, display}: {roomId: string; display: boolean}, context: Context) => model.whiteboardSendDisplay(context, display),
    whiteboardSendPermissions: (parent: any, {
      roomId, userId, permissions,
    }: {roomId: string; userId: string; permissions: string}, context: Context) => model.whiteboardSendPermissions(context, userId, permissions),
    mute: (parent: any, {
      roomId, sessionId, audio, video,
    }: {roomId: string; sessionId: string; audio?: boolean; video?: boolean}, context: Context) => model.mute(context, sessionId, audio, video),
    video: (parent: any, {
      roomId, sessionId, src, play, offset,
    }: {roomId: string; sessionId: string; src?: string; play?: boolean; offset?: number}, context: Context) => model.video(context, sessionId, src, play, offset),
    rewardTrophy: (parent: any, {
      roomId, user, kind,
    }: {roomId: string; user: string; kind: string}, context: Context) => model.rewardTrophy(context, user, kind),
    saveFeedback: (parent: any, {
      stars, feedbackType, comment, quickFeedback,
    }: { stars: number; feedbackType: string; comment: string; quickFeedback: {type: string; stars: number}[]}, context: Context) =>
      model.saveFeedback(context, stars, feedbackType, comment, quickFeedback),
    studentReport: (parent: any, {
      roomId, materialUrl, activityTypeName,
    }: {roomId: string; materialUrl: string; activityTypeName: string}, context: Context) => model.studentReport(context, materialUrl, activityTypeName),
    setClassAttendees: (parent: any, {roomId, userIds}: {roomId: string; userIds: [string]}, context: Context) => model.setClassAttendees(context, userIds),
  },
  Subscription: {
    room: {
      subscribe: (parent: any, {roomId, name}: {roomId: string; name: string}, context: Context) => model.joinRoom(context, name),
    },
    stream: {
      subscribe: (parent: any, {streamId, from}: { streamId: string; from: string}, context: Context) => model.stream(context, streamId, from),
    },
    video: {
      subscribe: (parent: any, {roomId, sessionId}: {roomId: string; sessionId: string}, context: Context) => model.videoSubscription(context, sessionId),
    },
    whiteboardEvents: {
      subscribe: (parent: any, {roomId}: {roomId: string}, context: Context) => model.whiteboardEvents(context),
    },
    whiteboardState: {
      subscribe: (parent: any, {roomId}: { roomId: string}, context: Context) => model.whiteboardState(context),
    },
    whiteboardPermissions: {
      subscribe: (parent: any, {roomId, userId}: {roomId: string; userId: string}, context: Context) => model.whiteboardPermissions(context, userId),
    },
  },
};
