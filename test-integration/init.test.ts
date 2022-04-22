import { globalSetup, globalTeardown} from "./config";
import { ready, token} from "./resolvers/query";
import { feedback, endClass, leaveClass, setSessionStreamId, setHost, sendMessage, postPageEvent, showContent, whiteboardSendEvent, whiteboardSendDisplay, mute, setClassAttendees} from "./resolvers/mutation";


jest.setTimeout(20*1000);


beforeAll(async () => {
    await globalSetup();
});

afterAll(async () => {
    await globalTeardown();
});

describe("API tests", () => {
    // Live class test
    ready();
    token();
    feedback();
    setSessionStreamId();
    leaveClass();
    endClass();
    setHost();
    sendMessage();
    postPageEvent();
    showContent();
    whiteboardSendEvent();
    whiteboardSendDisplay();
    mute();
    setClassAttendees();
});
