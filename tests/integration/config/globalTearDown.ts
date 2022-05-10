import { teardown } from "jest-dev-server";

export async function globalTeardown() {
    await teardown();
}