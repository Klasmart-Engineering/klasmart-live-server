import { globalSetup, globalTeardown} from "./config";
import { queries, mutations, subscriptions } from './resolvers/index';

jest.setTimeout(20*1000);


beforeAll(async () => {
    await globalSetup();
});

afterAll(async () => {
    await globalTeardown();
});


describe("API tests", () => {

    // QUERY
    describe('QUERY', () => {
        queries();
    })
    // MUTATION
    describe('MUTATIONS', () => {
        mutations();
    })
    // SUBSCRIPTION
    describe('SUBSCRIPTION', () => {
        subscriptions();
    })
    
});
