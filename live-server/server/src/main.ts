import { ApolloServer } from "apollo-server";
import { Model } from "./model";
import { schema } from "./schema";
import { Persist } from "./persist";
import { KidsLoopTokenDecoder } from "./services/auth-token/KidsLoopTokenDecoder";
import { DebugKeyProvider } from "./services/auth-token/key-provider/DebugKeyProvider";
import { IDecodedToken } from "./services/auth-token/token/IDecodedToken";
import { IncomingHttpHeaders } from "http";
import { IAuthenticationTokenDecoder } from "./services/auth-token/IAuthenticationTokenDecoder";

function getTokenFromBearerString (bearer: string | undefined) : string | undefined {
    if (!bearer) { return; }
    const parts = bearer.split(" ");
    if (parts.length === 2) { return; }
    return parts[1];
}

async function getTokenFromAuthorizationHeaders (decoder: IAuthenticationTokenDecoder, headers: IncomingHttpHeaders) {
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

interface Context {
  token?: IDecodedToken
  sessionId: string
}

async function main () {
    try {
        const keyProvider = new DebugKeyProvider();
        const tokenDecoder = new KidsLoopTokenDecoder(keyProvider);

        const model = await Model.create();
        const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE || "kidsloop_live_events_alphabeta";
        // const persist = await Persist.createDynamoClient(DYNAMODB_TABLE);

        const server = new ApolloServer({
            typeDefs: schema,
            subscriptions: {
                keepAlive: 1000,
                onConnect: async ({ authToken, sessionId }: any, _webSocket, connectionData: any): Promise<Context> => {
                    connectionData.sessionId = sessionId;
                    const token = authToken ? await tokenDecoder.decodeToken(authToken) : undefined;
                    return { token, sessionId };
                },
                onDisconnect: (websocket, connectionData) => { model.disconnect(connectionData); }
            },
            resolvers: {
                Query: {
                    ready: () => true
                },
                Mutation: {
                    setSessionStreamId: (_parent, { roomId, streamId }, context: Context) => model.setSessionStreamId(roomId, context.sessionId, streamId),
                    sendMessage: (_parent, { roomId, message }, context: Context) => model.sendMessage(roomId, context.sessionId, message),
                    postPageEvent: async (_parent, { streamId, pageEvents }, context: Context) => {
                        const a = model.postPageEvent(streamId, pageEvents).catch((e) => e);
                        return a;
                        // const b = persist.savePageEvent(streamId, pageEvents).catch((e) => e);
                        // const [posted2redis,saved2dynamo] = await Promise.all([a, b]);
                        // return posted2redis && saved2dynamo;
                    },
                    showContent: (_parent, { roomId, type, contentId }, context: Context) => model.showContent(roomId, type, contentId),
                    webRTCSignal: (_parent, { roomId, toSessionId, webrtc }, context: Context) => model.webRTCSignal(roomId, toSessionId, context.sessionId, webrtc)
                },
                Subscription: {
                    room: {
                        subscribe: (_parent, { roomId, name }, context: Context) => model.room(roomId, context.sessionId, name)
                    },
                    stream: {
                        subscribe: (_parent, { streamId, from }, context: Context) => model.stream(streamId, from)
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
