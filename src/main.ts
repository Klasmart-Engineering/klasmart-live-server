import 'newrelic';
import {Model} from './model';
import {resolvers} from './resolvers';
import {makeExecutableSchema} from '@graphql-tools/schema';
import dotenv from 'dotenv';
import Express from 'express';
import {createServer} from 'http';
import {GRAPHQL_WS} from 'subscriptions-transport-ws';
import {WebSocketServer} from 'ws';
import {typeDefs} from './typeDefs';
import {GRAPHQL_TRANSPORT_WS_PROTOCOL} from 'graphql-ws';
import {CustomApolloServer} from './servers/CustomApolloServer';
import {SubTransWsServer} from './servers/SubTransWsServer';
import {GraphqlWsServer} from './servers/GraphqlWsServer';

dotenv.config();

export let model: Model;

async function main() {
  try {
    model = await Model.create();
    const schema = makeExecutableSchema({
      typeDefs,
      resolvers,
    });

    // subscription-transport-ws server
    const subTransWs = new WebSocketServer({noServer: true});
    const subscriptionServer = SubTransWsServer.create(model, schema, subTransWs);

    // grapqhl-ws server
    const graphqlWs = new WebSocketServer({noServer: true});
    const graphqlWsServer = GraphqlWsServer.create(model, schema, graphqlWs);

    // apollo server
    const apolloServer = CustomApolloServer.create(schema, subscriptionServer, graphqlWsServer);

    const app = Express();
    app.use(Express.json({
      limit: `50mb`,
    }));
    app.use(Express.urlencoded({
      limit: `50mb`,
      extended: true,
      parameterLimit: 50000,
    }));

    // http server
    const httpServer = createServer(app);
    await apolloServer.start();
    apolloServer.applyMiddleware({
      app,
    });

    const port = process.env.PORT || 8000;

    // listen for upgrades and delegate requests according to the WS subprotocol
    httpServer.on('upgrade', (req, socket, head) => {
      // extract websocket subprotocol from header
      const protocol = req.headers['sec-websocket-protocol'];
      const protocols = Array.isArray(protocol) ?
        protocol :
        protocol?.split(',').map((p) => p.trim());

      const wss =
        protocols?.includes(GRAPHQL_WS) && // subscriptions-transport-ws subprotocol
        !protocols.includes(GRAPHQL_TRANSPORT_WS_PROTOCOL) ? // graphql-ws subprotocol
          subTransWs : graphqlWs;
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    });
    httpServer.listen({
      port,
    }, () => console.log(`🌎 Server ready at http://localhost:${port}${apolloServer.graphqlPath}`));
  } catch (e) {
    console.error(e);
    process.exit(-1);
  }
}

main();
