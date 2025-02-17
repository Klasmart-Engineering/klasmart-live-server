import {useServer} from "graphql-ws/lib/use/ws";
import WebSocket from "ws";
import {CloseCode} from "graphql-ws";
import {
    checkAuthenticationToken,
    checkLiveAuthorizationToken,
    KidsloopLiveAuthorizationToken,
    KidsloopAuthenticationToken,
} from "@kl-engineering/kidsloop-token-validation";
import cookie from "cookie";
import {GraphQLSchema} from "graphql";
import {Model} from "../model";
import {Context} from "../types";

export class GraphqlWsServer {
    static create(model: Model, schema: GraphQLSchema, graphqlWs: WebSocket.Server<WebSocket.WebSocket>) {
        const server = useServer(
            {
                context: async (ctx: any) => {
                    return ctx.context;
                },
                onConnect: async (ctx: any) => {
                    console.log("onConnect: graphql-ws ");
                    const socket = ctx.extra.socket;
                    socket.on("close", () => {
                        model.leaveRoom(ctx.context);
                    });
                    if ( !(await this.authenticate(ctx)) ) {
                        return false;
                    }
                    return true;
                },
                schema,
            },
            graphqlWs,
            1000
        );
        return server;
    }

    private static authenticate = async (ctx: any) => {
        const connectionParams = ctx.connectionParams;
        const authToken = connectionParams.authToken;
        const sessionId = connectionParams.sessionId;
        const websocket = ctx.extra.socket;

        const joinTime = new Date();
        let authorizationToken: KidsloopLiveAuthorizationToken;
        try {
            authorizationToken = await checkLiveAuthorizationToken(authToken);
        } catch (e: any) {
            if (e instanceof Error) {
                ctx.extra.socket.close(CloseCode.Forbidden, e.message);
            }
            return false;
        }

        const context : Context = {
            sessionId,
            websocket,
            joinTime,
            authorizationToken
        };

        if (process.env.DISABLE_AUTH) {
            ctx.context = context;
            return true;
        }

        let authenticationToken: KidsloopAuthenticationToken;
        const rawCookies = ctx.extra.request.headers.cookie;
        const cookies = rawCookies ? cookie.parse(rawCookies) : undefined;
        try {
            authenticationToken = await checkAuthenticationToken(cookies?.access);
        } catch (e: any) {
            if (e instanceof Error) {
                console.log("Error: ", e);
                ctx.extra.socket.close(CloseCode.Unauthorized, e.message);
            }
            return false;
        }

        if ( !authenticationToken.id || authenticationToken.id !== authorizationToken.userid) {
            console.log("ids dont match");
            ctx.extra.socket.close(CloseCode.Unauthorized, "Authentication Expired");
            return false;
        }
        context.authenticationToken = authenticationToken;
        ctx.context = context;
        return true;
    };
}
