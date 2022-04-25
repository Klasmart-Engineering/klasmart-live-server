import { PORT } from ".";
import { setup }  from "jest-dev-server";

export async function globalSetup() {

    await setup({
        command: "npm run dev",
        launchTimeout: 10000,
        debug: true,
        port: PORT
    });
    console.log("server started");
}