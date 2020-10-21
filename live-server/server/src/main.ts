import { ApolloServer } from "apollo-server";
import { Model } from "./model";
import { schema } from "./schema";
import { Persist } from "./persist";
import { KidsLoopTokenDecoder } from "./services/auth-token/KidsLoopTokenDecoder";
import { DebugKeyProvider } from "./services/auth-token/key-provider/DebugKeyProvider";
import { IDecodedToken } from "./services/auth-token/token/IDecodedToken";
import { IncomingHttpHeaders } from "http";
import { IAuthenticationTokenDecoder } from "./services/auth-token/IAuthenticationTokenDecoder";
import { StaticKeyProvider } from "./services/auth-token/key-provider/StaticKeyProvider";
import { VerificationCredentials } from "./services/auth-token/key-provider/IKeyProvider";
import * as Sentry from "@sentry/node";
import { RedisKeys } from "./redisKeys";
import WebSocket from "ws";

Sentry.init({
    dsn: "https://b78d8510ecce48dea32a0f6a6f345614@o412774.ingest.sentry.io/5388815",
    environment: process.env.NODE_ENV || "not-specified",
    release: "kidsloop-gql@" + process.env.npm_package_version,
});

function getTokenFromBearerString(bearer: string | undefined): string | undefined {
    if (!bearer) { return; }
    const parts = bearer.split(" ");
    if (parts.length === 2) { return; }
    return parts[1];
}

async function getTokenFromAuthorizationHeaders(decoder: IAuthenticationTokenDecoder, headers: IncomingHttpHeaders) {
    const tokenString = getTokenFromBearerString(headers.authorization);

    let token: IDecodedToken | undefined;
    if (tokenString) {
        try {
            token = await decoder.decodeToken(tokenString);
        } catch (error) {
            token = undefined;
        }
    }

    return token;
}

export interface Context {
    token?: IDecodedToken
    sessionId: string
    websocket: WebSocket
}

const TokenCredentials: VerificationCredentials[] = [
    { // Debug 
        id: "calmid-debug",
        issuer: "calmid-debug",
        audience: "kidsloop-live",
        algorithms: ["HS512", "HS256", "HS384"],
        certificate: "iXtZx1D5AqEB0B9pfn+hRQ=="
    },
    { // China
        id: "KidsLoopChinaUser-live",
        issuer: "KidsLoopChinaUser-live",
        audience: "kidsloop-live",
        algorithms: ["RS512"],
        certificate: ["-----BEGIN PUBLIC KEY-----",
            "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDAGN9KAcc61KBz8EQAH54bFwGK",
            "6PEQNVXXlsObwFd3Zos83bRm+3grzP0pKWniZ6TL/y7ZgFh4OlUMh9qJjIt6Lpz9",
            "l4uDxkgDDrKHn8IrflBxjJKq0OyXqwIYChnFoi/HGjcRtJhi8oTFToSvKMqIeUuL",
            "mWmLA8nXdDnMl7zwoQIDAQAB",
            "-----END PUBLIC KEY-----"].join("\n")
    }
];

async function main() {
    try {
        const keyProvider = new StaticKeyProvider(TokenCredentials);
        const tokenDecoder = new KidsLoopTokenDecoder(keyProvider);

        const model = await Model.create();
        const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE || "kidsloop_live_events_alphabeta";

        const server = new ApolloServer({
            typeDefs: schema,
            subscriptions: {
                keepAlive: 1000,
                onConnect: async ({ authToken, sessionId }: any, websocket, connectionData: any): Promise<Context> => {
                    connectionData.sessionId = sessionId;
                    const token = authToken ? await tokenDecoder.decodeToken(authToken) : undefined;
                    return { token, sessionId, websocket };
                },
                onDisconnect: (websocket, connectionData) => { model.disconnect(connectionData); }
            },
            resolvers: {
                Query: {
                    ready: () => true,
                    token: (_parent, _args, context: Context) => {
                        const token = context.token;
                        if (!token) {
                            return null;
                        }

                        if (!token.isValid()) {
                            return null;
                        }

                        if (token.isExpired()) {
                            return null;
                        }

                        const user = token.userInformation();
                        const room = token.roomInformation();

                        const result = {
                            subject: token.getSubject(),
                            audience: token.getAudience(),
                            userId: user?.id,
                            userName: user?.name,
                            isTeacher: user?.isTeacher,
                            organization: user?.organization,
                            roomId: room?.roomId,
                            materials: room?.materials
                        };

                        return result;
                    },
                    sfuAddress: (_parent, { roomId }, context: Context) => model.getSfuAddress(roomId),
                },
                Mutation: {
                    setSessionStreamId: (_parent, { roomId, streamId }, context: Context) => model.setSessionStreamId(roomId, context.sessionId, streamId),
                    sendMessage: (_parent, { roomId, message }, context: Context) => model.sendMessage(roomId, context.sessionId, message),
                    postPageEvent: async (_parent, { streamId, pageEvents }, context: Context) => {
                        const a = model.postPageEvent(streamId, pageEvents).catch((e) => e);
                        return a;
                    },
                    showContent: (_parent, { roomId, type, contentId }, context: Context) => model.showContent(roomId, type, contentId),
                    webRTCSignal: (_parent, { roomId, toSessionId, webrtc }, context: Context) => model.webRTCSignal(roomId, toSessionId, context.sessionId, webrtc),
                    whiteboardSendEvent: (_parent, { roomId, event }, _context: Context) => model.whiteboardSendEvent(roomId, event),
                    whiteboardSendDisplay: (_parent, { roomId, display }, _context: Context) => model.whiteboardSendDisplay(roomId, display),
                    whiteboardSendPermissions: (_parent, { roomId, userId, permissions }, _context: Context) => model.whiteboardSendPermissions(roomId, userId, permissions),
                    mute: (_parent, { roomId, sessionId, audio, video }, _context: Context) => model.mute(roomId, sessionId, audio, video),
                    video: (_parent, { roomId, sessionId, src, play, offset }, _context: Context) => model.video(roomId, sessionId, src, play, offset),
                    rewardTrophy: (_parent, { roomId, user, kind }, context: Context) => model.rewardTrophy({ sessionId: context.sessionId, roomId, user, kind }),
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
                if (connection) {
                    return connection.context;
                } else {
                    return { token: await getTokenFromAuthorizationHeaders(tokenDecoder, req.headers) };
                }
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
