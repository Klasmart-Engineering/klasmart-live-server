import "newrelic";
import newRelicApolloPlugin from "@newrelic/apollo-server-plugin";
import { createServer } from "http";
import dotenv from "dotenv";
import  Express from "express";
import { ApolloServer, ForbiddenError, ApolloError } from "apollo-server-express";
import { Model } from "./model";
import { SubscriptionServer } from "subscriptions-transport-ws";
import { execute, subscribe } from "graphql";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { resolvers } from "./resolvers";
import WebSocket = require("ws");
import { typeDefs } from "./typeDefs";
import { Context } from "./types";
import cookie from "cookie";

import {
    checkAuthenticationToken,
    checkLiveAuthorizationToken,
} from "kidsloop-token-validation";

dotenv.config();

export let model: Model;

async function main() {
    try {
        model = await Model.create();
        const schema = makeExecutableSchema({ typeDefs, resolvers });
        const server = new ApolloServer({
            schema,
            context: async ({ req }) => {
                
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
                newRelicApolloPlugin,
                {
                    async serverWillStart() {
                        return {
                            async drainServer() {
                                subscriptionServer.close();
                            }
                        };
                    }
                }
            ]
        });
        const app = Express();
        app.use(Express.json({ limit: "50mb" }));
        app.use(Express.urlencoded({ limit: "50mb", extended: true, parameterLimit: 50000 }));
        const httpServer = createServer(app);
        await server.start();
        server.applyMiddleware({ app });
        const subscriptionServer = SubscriptionServer.create(
            { schema, execute, subscribe,
                keepAlive: 1000,
                onConnect: async ({ authToken, sessionId }: any, websocket: WebSocket, connectionData: any): Promise<Context> => {
                    
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
                onDisconnect: (_websocket: WebSocket, connectionData: any) => { 
                    model.disconnect(connectionData as any);
                }
            },
            { server: httpServer, path: server.graphqlPath }
        );
        const port = process.env.PORT || 8000;
        
        httpServer.listen({ port }, () => console.log(`🌎 Server ready at http://localhost:${port}${server.graphqlPath}`));
    } catch (e) {
        console.error(e);
        process.exit(-1);
    }
}

main();