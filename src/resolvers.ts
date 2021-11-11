import { resolvers as resolver }  from "graphql-scalars";
import { PageEvent,  Context } from "./types";
import { model } from "./main";

export const resolvers = {
    ...resolver,
    Query: {
        ready: () => true,
        token: (_parent:  any, _args: any, { authorizationToken }: Context) => ({
            subject: authorizationToken?.sub,
            audience: authorizationToken?.aud,
            userId: authorizationToken?.userid,
            userName: authorizationToken?.name,
            isTeacher: authorizationToken?.teacher,
            roomId: authorizationToken?.roomid,
            materials: authorizationToken?.materials,
            classType: authorizationToken?.classtype,
        }),
        sfuAddress: (_parent: any, { roomId } : {roomId: string }) => model.getSfuAddress(roomId),
    },
    Mutation: {
        endClass: (_parent: any, _: any, context: Context) => model.endClass(context),
        leaveClass: (_parent: any, _: any, context: Context) => model.disconnect(context),
        setSessionStreamId: (_parent: any, { roomId, streamId } : {roomId:  string, streamId: string}, { sessionId }: Context) => model.setSessionStreamId(roomId, sessionId, streamId),
        setHost: (_parent: any, { roomId, nextHostId} : { roomId: string, nextHostId: string}) => model.setHost(roomId, nextHostId),
        sendMessage: (_parent: any, { roomId, message }: { roomId: string, message:string }, { sessionId }: Context) => model.sendMessage(roomId, sessionId, message),
        postPageEvent: async (_parent: any, { streamId, pageEvents }: { streamId: string, pageEvents: PageEvent[] }) => {
            const a = model.postPageEvent(streamId, pageEvents).catch((e) => e);
            return a;
        },
        showContent: (_parent: any, { roomId, type, contentId }: { roomId: string, type: string, contentId?: string }) => model.showContent(roomId, type, contentId),
        webRTCSignal: (_parent: any, { roomId, toSessionId, webrtc } : {roomId: string, toSessionId: string, sessionId: string | undefined, webrtc: any}, { sessionId }: Context) => model.webRTCSignal(roomId, toSessionId, sessionId, webrtc),
        whiteboardSendEvent: (_parent: any, { roomId, event }: {roomId: string, event: string}) => model.whiteboardSendEvent(roomId, event),
        whiteboardSendDisplay: (_parent: any, { roomId, display }: {roomId: string, display: boolean}) => model.whiteboardSendDisplay(roomId, display),
        whiteboardSendPermissions: (_parent: any, { roomId, userId, permissions }: {roomId: string, userId: string, permissions: string}) => model.whiteboardSendPermissions(roomId, userId, permissions),
        mute: (_parent: any, { roomId, sessionId, audio, video }: {roomId: string, sessionId: string, audio?: boolean, video?: boolean}) => model.mute(roomId, sessionId, audio, video),
        video: (_parent: any, { roomId, sessionId, src, play, offset } : {roomId: string, sessionId: string, src?: string, play?: boolean, offset?: number}) => model.video(roomId, sessionId, src, play, offset),
        rewardTrophy: (_parent: any, { roomId, user, kind }: {roomId: string, user: string, kind: string, sessionId?: string}, { sessionId }: Context) => model.rewardTrophy(roomId, user, kind, sessionId),
        saveFeedback: (_parent: any, { stars, feedbackType, comment, quickFeedback }: { stars: number, feedbackType: string, comment: string, quickFeedback: {type: string, stars: number}[]}, context: Context) => model.saveFeedback(context, stars, feedbackType, comment, quickFeedback),
        studentReport: (_parent: any, { roomId, materialUrl, activityTypeName } : {roomId: string, materialUrl: string, activityTypeName:string}, _context: Context) => model.studentReport(roomId, _context, materialUrl, activityTypeName),
    },
    Subscription: {
        room: {
            subscribe: (_parent: any, { roomId, name } : {roomId: string, name: string}, context: Context) => model.room(context, roomId, name)
        },
        stream: {
            subscribe: (_parent: any, { streamId, from }: { streamId: string, from: string}, context: Context) => model.stream(context, streamId, from)
        },
        video: {
            subscribe: (_parent: any, { roomId, sessionId }: {roomId: string, sessionId: string}, context: Context) => model.videoSubscription(context, roomId, sessionId)
        },
        whiteboardEvents: {
            subscribe: (_parent: any, { roomId }: {roomId: string}, context: Context) => model.whiteboardEvents(context, roomId)
        },
        whiteboardState: {
            subscribe: (_parent: any, { roomId }: { roomId: string}, context: Context) => model.whiteboardState(context, roomId)
        },
        whiteboardPermissions: {
            subscribe: (_parent: any, { roomId, userId }: {roomId: string, userId: string}, context: Context) => model.whiteboardPermissions(context, roomId, userId)
        }
    }
};