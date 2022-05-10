export const PORT=8000;
export const ENDPOINT_HTTP = `http://localhost:${PORT}/graphql`;
export const ENDPOINT_WS = `ws://localhost:${PORT}/graphql`;
export { globalSetup } from "./globalSetup";
export { globalTeardown } from "./globalTearDown";
