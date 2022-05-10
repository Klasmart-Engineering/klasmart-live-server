import { PORT } from ".";
import { setup }  from "jest-dev-server";

export async function globalSetup() {

    await setup({
        command: "DISABLE_AUTH=1 npm run dev",
        launchTimeout: 20000,
        debug: true,
        port: PORT
    });
    console.log("server started");
}