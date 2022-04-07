import {GraphQLSchema} from 'graphql';
import newRelicApolloPlugin from '@newrelic/apollo-server-plugin';
import cookie from 'cookie';
import {
  ApolloError,
  ApolloServer,
  ForbiddenError,
} from 'apollo-server-express';
import {SubscriptionServer} from 'subscriptions-transport-ws';
import {Disposable} from 'graphql-ws/lib/common';
import {
  checkAuthenticationToken,
  checkLiveAuthorizationToken,
} from 'kidsloop-token-validation';
export class CustomApolloServer {
  static create(schema: GraphQLSchema, subscriptionServer: SubscriptionServer, graphqlWsServer: Disposable) {
    return new ApolloServer({
      schema,
      context: async ({req}) => {
        const authHeader = req.headers.authorization;
        const rawAuthorizationToken = authHeader?.substr(0, 7).toLowerCase() === `bearer ` ? authHeader.substr(7) : authHeader;
        const authorizationToken = await checkLiveAuthorizationToken(rawAuthorizationToken).catch((e) => {
          throw new ForbiddenError(e);
        });

        if (process.env.DISABLE_AUTH) {
          return {
            authorizationToken,
          };
        }
        const rawCookies = req.headers.cookie;
        const cookies = rawCookies ? cookie.parse(rawCookies) : undefined;
        const authenticationToken = await checkAuthenticationToken(cookies?.access).catch((e) => {
          if (e.name === `TokenExpiredError`) {
            throw new ApolloError(`AuthenticationExpired`, `AuthenticationExpired`);
          }
          throw new ApolloError(`AuthenticationInvalid`, `AuthenticationInvalid`);
        });
        if (!authenticationToken.id || authenticationToken.id !== authorizationToken.userid) {
          throw new ForbiddenError(`The authorization token does not match your session token`);
        }

        return {
          authorizationToken,
          authenticationToken,
        };
      },
      plugins: [
        newRelicApolloPlugin,
        {
          async serverWillStart() {
            return {
              async drainServer() {
                subscriptionServer.close();
                await graphqlWsServer.dispose();
              },
            };
          },
        },
      ],
    });
  }
}
