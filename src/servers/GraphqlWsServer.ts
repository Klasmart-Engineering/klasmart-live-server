import {useServer} from 'graphql-ws/lib/use/ws';
import WebSocket from 'ws';
import { CloseCode } from 'graphql-ws';

import {
  checkAuthenticationToken,
  checkLiveAuthorizationToken,
  KidsloopLiveAuthorizationToken,
  KidsloopAuthenticationToken
} from 'kidsloop-token-validation';
import cookie from 'cookie';
import {GraphQLSchema} from 'graphql';
import { Model } from "../model";

export class GraphqlWsServer {
  static create(model: Model, schema: GraphQLSchema, graphqlWs: WebSocket.Server<WebSocket.WebSocket>) {
    const server =  useServer(
        {
          context: async (ctx: any) => {
            console.log('context: graphql-ws ');
            
            const context = await this.createContext(ctx);
            return context; 
          },
          onConnect: async (ctx) => {
            console.log('onConnect: graphql-ws ');
            if( !(await this.checkAuth(ctx)) ){
              return false;
            }
            return true;
          },
          onDisconnect: async (ctx) => {
            console.log('onDisconnect: graphql-ws');
            const context = await this.createContext(ctx);
            model.leaveRoom(context);
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
    const authorizationToken = await checkLiveAuthorizationToken(authToken);
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

    const authenticationToken = await checkAuthenticationToken(cookies?.access);
    (connectionParams as any).authenticationToken = authenticationToken;
    return {
      authenticationToken,
      authorizationToken,
      sessionId,
      websocket,
      joinTime,
    };
  }

  private static checkAuth = async (ctx: any) => {
    const authToken = ctx.connectionParams.authToken;
    let authorizationToken: KidsloopLiveAuthorizationToken;
    try {
      authorizationToken = await checkLiveAuthorizationToken(authToken)
    } catch(e) {
      ctx.extra.socket.close(CloseCode.Forbidden, 'Forbidden')
      return false;
    }
    
    if (process.env.DISABLE_AUTH) {
      return true
    }
    
    const rawCookies = ctx.extra.request.headers.cookie;
    const cookies = rawCookies ? cookie.parse(rawCookies) : undefined;

    let authenticationToken: KidsloopAuthenticationToken;
    try { 
      authenticationToken = await checkAuthenticationToken(cookies?.access)
    } catch(e) {
      if (e.name === `TokenExpiredError`) {
        ctx.extra.socket.close(CloseCode.Unauthorized, 'TokenExpiredError');
        return false;
      }
      
      ctx.extra.socket.close(CloseCode.Unauthorized, 'AuthenticationInvalid');
      return false;
    }

    if ( !authenticationToken.id || authenticationToken.id !== authorizationToken.userid) {
      ctx.extra.socket.close(CloseCode.Unauthorized, 'AuthenticationExpired');
      return false;
    }

    return true
  }

  
}
