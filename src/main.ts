import "newrelic";
import newRelicApolloPlugin from "@newrelic/apollo-server-plugin";
import dotenv from "dotenv";
import { ApolloServer, ForbiddenError, ApolloError } from "apollo-server";
import { Model } from "./model";
import { schema } from "./schema";
import WebSocket from "ws";
import { resolvers } from "graphql-scalars";
import cookie from "cookie";

import {
    checkAuthenticationToken,
    checkLiveAuthorizationToken,
    KidsloopAuthenticationToken,
    KidsloopLiveAuthorizationToken,
} from "kidsloop-token-validation";

dotenv.config();
export interface Context {
    authenticationToken?: KidsloopAuthenticationToken
    authorizationToken?: KidsloopLiveAuthorizationToken
    sessionId?: string
    roomId?: string
    websocket?: WebSocket
    joinTime?: Date
}

async function main() {
    try {
        const model = await Model.create();
        const server = new ApolloServer({
            typeDefs: schema,
            subscriptions: {
                keepAlive: 1000,
                onConnect: async ({ authToken, sessionId }: any, websocket, connectionData): Promise<Context> => {
                    const authorizationToken = await checkLiveAuthorizationToken(authToken).catch((e) => { throw new ForbiddenError(e); });
                    const rawCookies = connectionData.request.headers.cookie;
                    const cookies = rawCookies ? cookie.parse(rawCookies) : undefined;
                    const joinTime = new Date();
                    (connectionData as any).sessionId = sessionId;
                    (connectionData as any).authorizationToken = authorizationToken;
                    (connectionData as any).joinTime = joinTime;
                    if(process.env.DISABLE_AUTH){
                        console.warn("SKIPPING AUTHENTICATION");
                        return { authorizationToken, sessionId, websocket, joinTime };
                    }

                    const authenticationToken = await checkAuthenticationToken(cookies?.access).catch((e) => {
                        if (e.name === "TokenExpiredError") { throw new ApolloError("AuthenticationExpired", "AuthenticationExpired"); }
                        throw new ApolloError("AuthenticationInvalid", "AuthenticationInvalid");
                    });
                    if (!authenticationToken.id || authenticationToken.id !== authorizationToken.userid) {
                        throw new ForbiddenError("The authorization token does not match your session token");
                    }
                    (connectionData as any).authenticationToken = authenticationToken;
                    return { authenticationToken, authorizationToken, sessionId, websocket, joinTime  };
                    
                    
                },
                onDisconnect: (_websocket, connectionData) => { 
                    model.disconnect(connectionData as any);
                }
            },
            resolvers: {
                ...resolvers,
                Query: {
                    ready: () => true,
                    token: (_parent, _args, { authorizationToken }: Context) => ({
                        subject: authorizationToken?.sub,
                        audience: authorizationToken?.aud,
                        userId: authorizationToken?.userid,
                        userName: authorizationToken?.name,
                        isTeacher: authorizationToken?.teacher,
                        roomId: authorizationToken?.roomid,
                        materials: authorizationToken?.materials,
                        classType: authorizationToken?.classtype,
                    }),
                    sfuAddress: (_parent, { roomId }) => model.getSfuAddress(roomId),
                },
                Mutation: {
                    endClass: (_parent, _, context: Context) => model.endClass(context),
                    leaveClass: (_parent, _, context: Context) => model.disconnect(context),
                    setSessionStreamId: (_parent, { roomId, streamId }, { sessionId }: Context) => model.setSessionStreamId(roomId, sessionId, streamId),
                    setHost: (_parent, { roomId, nextHostId}) => model.setHost(roomId, nextHostId),
                    sendMessage: (_parent, { roomId, message }, { sessionId }: Context) => model.sendMessage(roomId, sessionId, message),
                    postPageEvent: async (_parent, { streamId, pageEvents }) => {
                        const a = model.postPageEvent(streamId, pageEvents).catch((e) => e);
                        return a;
                    },
                    showContent: (_parent, { roomId, type, contentId}) => model.showContent(roomId, type, contentId),
                    webRTCSignal: (_parent, { roomId, toSessionId, webrtc }, { sessionId }: Context) => model.webRTCSignal(roomId, toSessionId, sessionId, webrtc),
                    whiteboardSendEvent: (_parent, { roomId, event }, _context: Context) => model.whiteboardSendEvent(roomId, event),
                    whiteboardSendDisplay: (_parent, { roomId, display }, _context: Context) => model.whiteboardSendDisplay(roomId, display),
                    whiteboardSendPermissions: (_parent, { roomId, userId, permissions }, _context: Context) => model.whiteboardSendPermissions(roomId, userId, permissions),
                    mute: (_parent, { roomId, sessionId, audio, video }, _context: Context) => model.mute(roomId, sessionId, audio, video),
                    video: (_parent, { roomId, sessionId, src, play, offset }, _context: Context) => model.video(roomId, sessionId, src, play, offset),
                    rewardTrophy: (_parent, { roomId, user, kind }, { sessionId }: Context) => model.rewardTrophy(roomId, user, kind, sessionId),
                    saveFeedback: (_parent, { stars, feedbackType, comment, quickFeedback }, context: Context) => model.saveFeedback(context, stars, feedbackType, comment, quickFeedback),
                    studentReport: (_parent, { roomId, materialUrl, activityTypeName }, _context: Context) => model.studentReport(roomId, _context, materialUrl, activityTypeName),
                },
                Subscription: {
                    room: {
                        subscribe: (_parent, { roomId, name }, context: Context) => model.room(context, roomId, name)
                    },
                    stream: {
                        subscribe: (_parent, { streamId, from }, context: Context) => model.stream(context, streamId, from)
                    },
                    video: {
                        subscribe: (_parent, { roomId, sessionId }, context: Context) => model.videoSubscription(context, roomId, sessionId)
                    },
                    whiteboardEvents: {
                        subscribe: (_parent, { roomId }, context: Context) => model.whiteboardEvents(context, roomId)
                    },
                    whiteboardState: {
                        subscribe: (_parent, { roomId }, context: Context) => model.whiteboardState(context, roomId)
                    },
                    whiteboardPermissions: {
                        subscribe: (_parent, { roomId, userId }, context: Context) => model.whiteboardPermissions(context, roomId, userId)
                    }
                }
            },
            context: async ({ req, connection }) => {
                if (connection) { return connection.context; }

                const authHeader = req.headers.authorization;
                const rawAuthorizationToken = authHeader?.substr(0, 7).toLowerCase() === "bearer " ? authHeader.substr(7) : authHeader;
                const authorizationToken = await checkLiveAuthorizationToken(rawAuthorizationToken).catch((e) => { throw new ForbiddenError(e); });
                
                if(process.env.DISABLE_AUTH) {
                    console.warn("skipping AUTHENTICATION");
                    return { authorizationToken };
                }
                const rawCookies = req.headers.cookie;
                const cookies = rawCookies ? cookie.parse(rawCookies) : undefined;
                const authenticationToken = await checkAuthenticationToken(cookies?.access).catch((e) => {
                    if (e.name === "TokenExpiredError") { throw new ApolloError("AuthenticationExpired", "AuthenticationExpired"); }
                    throw new ApolloError("AuthenticationInvalid", "AuthenticationInvalid");
                });
                if (!authenticationToken.id || authenticationToken.id !== authorizationToken.userid) {
                    throw new ForbiddenError("The authorization token does not match your session token");
                }

                return { authorizationToken, authenticationToken };
            },
            plugins: [
                newRelicApolloPlugin
            ]
        });

        const port = process.env.PORT || 8000;

        server.listen({ port }, () => console.log(`🌎 Server ready at http://localhost:${port}${server.graphqlPath}`));
    } catch (e) {
        console.error(e);
        process.exit(-1);
    }
}

main();