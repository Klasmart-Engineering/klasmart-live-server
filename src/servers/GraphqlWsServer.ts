import {useServer} from 'graphql-ws/lib/use/ws';
import WebSocket from 'ws';
import {
  ApolloError,
  ForbiddenError,
} from 'apollo-server-express';

import {
  checkAuthenticationToken,
  checkLiveAuthorizationToken,
} from 'kidsloop-token-validation';
import cookie from 'cookie';
import {GraphQLSchema} from 'graphql';
import { Model } from "../model";

export class GraphqlWsServer {
  static create(model: Model, schema: GraphQLSchema, graphqlWs: WebSocket.Server<WebSocket.WebSocket>) {
    const server =  useServer(
        {
          context: async (ctx: any) => {
            const context = this.createContext(ctx);
            return context; 
          },
          onConnect: (ctx) => {
            console.log('onConnect: graphql-ws');
          },
          onDisconnect: (ctx) => {
            const context = this.createContext(ctx);
            model.leaveRoom(context);
            console.log('onDisconnect: graphql-ws');
          },
          schema,
        },
        graphqlWs,
    );
    return server;
  }

  private static createContext = async (ctx: any) => {
    const connectionParams = ctx.connectionParams;
    const authToken = connectionParams.authToken;
    const sessionId = connectionParams.sessionId;
    const websocket = ctx.extra.socket;
    const authorizationToken = await checkLiveAuthorizationToken(authToken).catch((e) => {
      throw new ForbiddenError(e);
    });
    const rawCookies = ctx.extra.request.headers.cookie;
    const cookies = rawCookies ? cookie.parse(rawCookies) : undefined;
    const joinTime = new Date();
    (connectionParams as any).authorizationToken = authorizationToken;
    (connectionParams as any).joinTime = joinTime;
    if (process.env.DISABLE_AUTH) {
      return {
        authorizationToken,
        sessionId,
        websocket,
        joinTime,
      };
    }

    const authenticationToken = await checkAuthenticationToken(cookies?.access).catch((e) => {
      if (e.name === `TokenExpiredError`) {
        throw new ApolloError(`AuthenticationExpired`, `AuthenticationExpired`);
      }
      throw new ApolloError(`AuthenticationInvalid`, `AuthenticationInvalid`);
    });
    if (!authenticationToken.id || authenticationToken.id !== authorizationToken.userid) {
      throw new ForbiddenError(`The authorization token does not match your session token`);
    }
    (connectionParams as any).authenticationToken = authenticationToken;
    return {
      authenticationToken,
      authorizationToken,
      sessionId,
      websocket,
      joinTime,
    };
  }
}
