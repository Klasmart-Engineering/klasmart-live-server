import { model } from "./main";
import {
    Context,
    PageEvent,
} from "./types";
import { resolvers as resolver }  from "graphql-scalars";

export const resolvers = {
    ...resolver,
    Query: {
        ready: () => true,
        token: (parent:  any, args: any, { authorizationToken }: Context) => ({
            subject: authorizationToken?.sub,
            audience: authorizationToken?.aud,
            userId: authorizationToken?.userid,
            userName: authorizationToken?.name,
            isTeacher: authorizationToken?.teacher,
            roomId: authorizationToken?.roomid,
            materials: authorizationToken?.materials,
            classType: authorizationToken?.classtype,
        }),
        sfuAddress: (parent: any, { roomId }: {roomId: string }) => model.getSfuAddress(roomId),
    },
    Mutation: {
        endClass: (parent: any, arg: any, context: Context) => model.endClass(context),
        leaveClass: (parent: any, arg: any, context: Context) => model.disconnect(context),
        setSessionStreamId: (parent: any, { roomId, streamId }: {roomId:  string; streamId: string}, { sessionId }: Context) => model.setSessionStreamId(roomId, sessionId, streamId),
        setHost: (parent: any, { roomId, nextHostId }: { roomId: string; nextHostId: string}) => model.setHost(roomId, nextHostId),
        sendMessage: (parent: any, { roomId, message }: { roomId: string; message: string }, { sessionId }: Context) => model.sendMessage(roomId, sessionId, message),
        postPageEvent: (parent: any, { streamId, pageEvents }: { streamId: string; pageEvents: PageEvent[] }) => {
            const a = model.postPageEvent(streamId, pageEvents).catch((e) => e);
            return a;
        },
        showContent: (parent: any, {
            roomId, type, contentId,
        }: { roomId: string; type: string; contentId?: string }) => model.showContent(roomId, type, contentId),
        webRTCSignal: (parent: any, {
            roomId, toSessionId, webrtc,
        }: {roomId: string; toSessionId: string; sessionId: string | undefined; webrtc: any}, { sessionId }: Context) => model.webRTCSignal(roomId, toSessionId, sessionId, webrtc),
        whiteboardSendEvent: (parent: any, { roomId, event }: {roomId: string; event: string}) => model.whiteboardSendEvent(roomId, event),
        whiteboardSendDisplay: (parent: any, { roomId, display }: {roomId: string; display: boolean}) => model.whiteboardSendDisplay(roomId, display),
        whiteboardSendPermissions: (parent: any, {
            roomId, userId, permissions,
        }: {roomId: string; userId: string; permissions: string}) => model.whiteboardSendPermissions(roomId, userId, permissions),
        mute: (parent: any, {
            roomId, sessionId, audio, video,
        }: {roomId: string; sessionId: string; audio?: boolean; video?: boolean}) => model.mute(roomId, sessionId, audio, video),
        video: (parent: any, {
            roomId, sessionId, src, play, offset,
        }: {roomId: string; sessionId: string; src?: string; play?: boolean; offset?: number}) => model.video(roomId, sessionId, src, play, offset),
        rewardTrophy: (parent: any, {
            roomId, user, kind,
        }: {roomId: string; user: string; kind: string; sessionId?: string}, { sessionId }: Context) => model.rewardTrophy(roomId, user, kind, sessionId),
        saveFeedback: (parent: any, {
            stars, feedbackType, comment, quickFeedback,
        }: { stars: number; feedbackType: string; comment: string; quickFeedback: {type: string; stars: number}[]}, context: Context) => model.saveFeedback(context, stars, feedbackType, comment, quickFeedback),
        studentReport: (parent: any, {
            roomId, materialUrl, activityTypeName,
        }: {roomId: string; materialUrl: string; activityTypeName: string}, context: Context) => model.studentReport(roomId, context, materialUrl, activityTypeName),
    },
    Subscription: {
        room: {
            subscribe: (parent: any, { roomId, name }: {roomId: string; name: string}, context: Context) => model.room(context, roomId, name),
        },
        stream: {
            subscribe: (parent: any, { streamId, from }: { streamId: string; from: string}, context: Context) => model.stream(context, streamId, from),
        },
        video: {
            subscribe: (parent: any, { roomId, sessionId }: {roomId: string; sessionId: string}, context: Context) => model.videoSubscription(context, roomId, sessionId),
        },
        whiteboardEvents: {
            subscribe: (parent: any, { roomId }: {roomId: string}, context: Context) => model.whiteboardEvents(context, roomId),
        },
        whiteboardState: {
            subscribe: (parent: any, { roomId }: { roomId: string}, context: Context) => model.whiteboardState(context, roomId),
        },
        whiteboardPermissions: {
            subscribe: (parent: any, { roomId, userId }: {roomId: string; userId: string}, context: Context) => model.whiteboardPermissions(context, roomId, userId),
        },
    },
};
