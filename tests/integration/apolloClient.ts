import {ENDPOINT_WS} from "./config";
import { getUniqueId } from "./mockData/functions";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import {
    ApolloClient,
    InMemoryCache,
    DocumentNode,
    TypedDocumentNode
} from "@apollo/client";
import WebSocket from "ws"; // yarn add ws
import { createClient, ClientOptions } from "graphql-ws";


export class CustomApolloClient {

    private client: any;

    constructor(authToken: string){
        const sessionId = getUniqueId();
        const options: ClientOptions = {
            url: ENDPOINT_WS,
            keepAlive: 1000,
            webSocketImpl: WebSocket,
            connectionParams: {
                authToken,
                sessionId,
            },
            isFatalConnectionProblem: () => {
                return false;
            },
            retryWait: async function waitForServerHealthyBeforeRetry() {
                console.log("console retryWait");
                await new Promise((resolve) =>
                    setTimeout(resolve, 10000),
                );
            },
            on: {
                "connected": () => {
                    console.log("console connected to graphql");
                },
                "closed": () => {
                    console.log("socket connection closed");
                },
                "error": (error: unknown) => {
                    if (error instanceof Error) {
                        console.log("ERROR IN GRAPHQL CONNECTION: ", error.message);
                    }
                }

            }
        };
        const wsClient = createClient(options);
        const link = new GraphQLWsLink(wsClient);
        this.client = new ApolloClient({
            cache: new InMemoryCache(),
            link,
        });
   
    }

    stop(){
        this.client.stop();
    }

    createSubscription(params: queryParams) {
        const results : any[] = [];

        let error : any;

        const observer = this.client.subscribe({
            errorPolicy: "all",
            query: params.query,
            variables: params.variables || {}
        }).subscribe({
            next(data: any) { results.push(data); },
            error: (err: unknown) => { error = err; }
        });

        return {
            results,
            observer,

            disconnect() {
                observer.unsubscribe();
            },

            wait(ms  = 100) {
                return new Promise(done => {
                    setTimeout(() => { done(null); }, ms);
                });
            },

            waitForResults(opts : { len?: number, timeout?: number } = {}) {
                return new Promise((done, fail) => {
                    const step    = 2;
                    let sum     = 0;
                    const timeout = opts.timeout ?? 30;
                    const len     = opts.len ?? 1;

                    const interval = setInterval(() => {
                        if (!error && results.length >= len) {
                            clearInterval(interval);
                            return done(results);
                        }
                        if (error || sum >= timeout) {
                            error = error || new Error(
                                `Timeout: subscription did not receive the expected results after ${timeout}ms`
                            );
                            clearInterval(interval);
                            return fail(error);
                        }
                        sum += step;
                    }, step);
                });
            },

            get triggerCount() {
                return results.length;
            },

            get error () {
                return error;
            }
        };
    
    }

    async createMutation(params: queryParams) {
        return this.client.mutate({
            errorPolicy: "all",
            mutation: params.query,
            variables: params.variables || {}
        });
    }

    async createQuery(params: queryParams) {
        return this.client.query({
            errorPolicy: "all",
            query: params.query,
            variables: params.variables || {}
        });
    }

}

type queryParams = {
  query: DocumentNode | TypedDocumentNode,
  variables?: any
}
