import {
  execute,
  GraphQLSchema,
  subscribe,
} from 'graphql';
import {
  ApolloError,
  ForbiddenError,
} from 'apollo-server-express';
import {SubscriptionServer} from 'subscriptions-transport-ws';
import WebSocket from 'ws';
import {Context} from '../types';
import cookie from 'cookie';
import {
  checkAuthenticationToken,
  checkLiveAuthorizationToken,
} from 'kidsloop-token-validation';
import {Model} from 'src/model';

export class SubTransWsServer {
  static create(model: Model, schema: GraphQLSchema, subTransWs: WebSocket.Server<WebSocket.WebSocket>) {
    return SubscriptionServer.create({
      schema,
      execute,
      subscribe,
      keepAlive: 1000,
      onConnect: async ({authToken, sessionId}: any, websocket: WebSocket, connectionData: any): Promise<Context> => {
        console.log('onConnect: subscriptionServer')
        const authorizationToken = await checkLiveAuthorizationToken(authToken).catch((e) => {
          throw new ForbiddenError(e);
        });
        const rawCookies = connectionData.request.headers.cookie;
        const cookies = rawCookies ? cookie.parse(rawCookies) : undefined;
        const joinTime = new Date();
        (connectionData as any).sessionId = sessionId;
        (connectionData as any).authorizationToken = authorizationToken;
        (connectionData as any).joinTime = joinTime;
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
        (connectionData as any).authenticationToken = authenticationToken;
        return {
          authenticationToken,
          authorizationToken,
          sessionId,
          websocket,
          joinTime,
        };
      },
      onDisconnect: (websocket: WebSocket, connectionData: any) => {
        console.log('onDisconnect: subscriptionServer');
        model.leaveRoom(connectionData as any);
      },
    },
    subTransWs,
    );
  }
}
