import { ApolloServer } from "apollo-server";
import { Model } from "./model";
import { schema } from "./schema";
import { createConnection } from "typeorm";
import * as Sentry from "@sentry/node";
import WebSocket from "ws";
import { checkToken, JWT } from "./auth";
import { resolvers } from "graphql-scalars";

Sentry.init({
    dsn: "https://b78d8510ecce48dea32a0f6a6f345614@o412774.ingest.sentry.io/5388815",
    environment: process.env.NODE_ENV || "not-specified",
    release: "kidsloop-gql@" + process.env.npm_package_version,
});

export interface Context {
    token?: JWT
    sessionId?: string
    roomId?: string
    websocket?: WebSocket
    joinTime?: Date
}

async function connectPostgres() {
    if(!process.env.DATABASE_URL) {
        console.log("Attendance db not configured - skipping");
        return;
    }
    const connection = await createConnection({
        name: "default",
        type: "postgres",
        url: process.env.DATABASE_URL || "postgres://postgres:kidsloop@localhost",
        synchronize: true,
        logging: Boolean(process.env.DATABASE_LOGGING),
        entities: ["src/entities/*.ts"],
    });
    console.log("🐘 Connected to postgres");
    return connection;
}

async function main() {
    try {
        await connectPostgres();
        const model = await Model.create();
        const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE || "kidsloop_live_events_alphabeta";

        const server = new ApolloServer({
            typeDefs: schema,
            subscriptions: {
                keepAlive: 1000,
                onConnect: async ({ authToken, sessionId }: any, websocket, connectionData: any): Promise<Context> => {
                    const token = await checkToken(authToken);
                    const joinTime = new Date();

                    connectionData.sessionId = sessionId;
                    connectionData.token = token;
                    connectionData.joinTime = joinTime;
                    return { token, sessionId, websocket, joinTime };
                },
                onDisconnect: (websocket, connectionData) => { model.disconnect(connectionData as any); }
            },
            resolvers: {
                ...resolvers,
                Query: {
                    ready: () => true,
                    token: (_parent, _args, {token}: Context) => ({
                        subject: token?.sub,
                        audience: token?.aud,
                        userId: token?.userid,
                        userName: token?.name,
                        isTeacher: token?.teacher,
                        roomId: token?.roomid,
                        materials: token?.materials
                    }),
                    sfuAddress: (_parent, { roomId }, context: Context) => model.getSfuAddress(roomId),
                },
                Mutation: {
                    endClass: (_parent, args, context: Context) => model.endClass(context),
                    setSessionStreamId: (_parent, { roomId, streamId }, {sessionId}: Context) => model.setSessionStreamId(roomId, sessionId, streamId),
                    setHost: (_parent, { roomId, hostId }, context: Context) => model.setHost(roomId, hostId),
                    sendMessage: (_parent, { roomId, message }, {sessionId}: Context) => model.sendMessage(roomId, sessionId, message),
                    postPageEvent: async (_parent, { streamId, pageEvents }, context: Context) => {
                        const a = model.postPageEvent(streamId, pageEvents).catch((e) => e);
                        return a;
                    },
                    showContent: (_parent, { roomId, type, contentId }, context: Context) => model.showContent(roomId, type, contentId),
                    webRTCSignal: (_parent, { roomId, toSessionId, webrtc }, {sessionId}: Context) => model.webRTCSignal(roomId, toSessionId, sessionId, webrtc),
                    whiteboardSendEvent: (_parent, { roomId, event }, _context: Context) => model.whiteboardSendEvent(roomId, event),
                    whiteboardSendDisplay: (_parent, { roomId, display }, _context: Context) => model.whiteboardSendDisplay(roomId, display),
                    whiteboardSendPermissions: (_parent, { roomId, userId, permissions }, _context: Context) => model.whiteboardSendPermissions(roomId, userId, permissions),
                    mute: (_parent, { roomId, sessionId, audio, video }, _context: Context) => model.mute(roomId, sessionId, audio, video),
                    video: (_parent, { roomId, sessionId, src, play, offset }, _context: Context) => model.video(roomId, sessionId, src, play, offset),
                    rewardTrophy: (_parent, { roomId, user, kind }, {sessionId}: Context) => model.rewardTrophy(roomId, user, kind, sessionId),
                    saveFeedback: (_parent, { stars, feedbackType, message, quickFeedback }, context: Context) => model.saveFeedback(context, stars, feedbackType, message, quickFeedback),
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
                const token = await checkToken(req.headers.authorization);
                return { token };
            }
        });

        const port = process.env.PORT || 8000;

        server.listen({ port }, () => console.log(`🌎 Server ready at http://localhost:${port}${server.graphqlPath}`));
    } catch (e) {
        console.error(e);
        process.exit(-1);
    }
}
main();
