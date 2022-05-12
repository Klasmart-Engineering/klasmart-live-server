import { getRandomFeedbackType, getRandomBoolean, getRandomQuickFeedbackType, getRandomNumber, getUniqueId, getRandomString } from "./functions";
import { PainterEvent } from "../../../src/services/whiteboard/events/PainterEvent";
import { ContentMessageType } from "../../../src/types";
import { WhiteboardPermissions } from "./types";

export const attendanceMockData = {
    roomId: getUniqueId(),
    userId: getUniqueId(),
    sessionId: getUniqueId(),
    joinTimestamp: "2021-10-08T20:48:40.446Z",
    leaveTimestamp: "2021-10-08T20:48:40.446Z",
};

export const feedbackMockData = {
    stars: getRandomNumber(5)+1,
    comment: "was awesome",
    feedbackType: getRandomFeedbackType(),
    quickFeedback: { type: getRandomQuickFeedbackType(), stars: getRandomNumber(5)+1 }
};

export const pageEventMockData = {
    sequenceNumber: getRandomNumber(100),
    isKeyframe: getRandomBoolean(),
    eventsSinceKeyframe: getRandomNumber(20),
    eventData: getRandomString(200)
};

const ContentTypeArr: string[] =  [
    "Blank","Stream","Activity","Video","Audio","Image","Camera","Screen",
];

export const contentTypeMockData: ContentMessageType = {
    type: ContentTypeArr[getRandomNumber(8)],
    contentId: getRandomString(10)
};


export const whiteboardSendEventMockData: PainterEvent = {
    type: getRandomString(10),
    id: getUniqueId(),
    generatedBy: getRandomString(10),
    objectType: getRandomString(10),
    param: getRandomString(10)
};

export const whiteboardSendPermissionsMockData: WhiteboardPermissions = {
    allowShowHide: getRandomBoolean(),
    allowCreateShapes: getRandomBoolean(),
    allowEditShapes: {
        own: getRandomBoolean(),
        others: getRandomBoolean(),
    },
    allowDeleteShapes: {
        own: getRandomBoolean(),
        others: getRandomBoolean()
    },
};

const thropyArr = ["trophy","great_job","star","heart"];
export const rewardThropyMockData = {
    kind: thropyArr[getRandomNumber(thropyArr.length)]
};


const activityTypeArr = ["h5p", "audio","video","image"];
const materialUrlArr = [
    "/h5p/play/61dbd45290c8380013f4e224",
    "/h5p/play/61dbd51e52f46a0015552d52",
    "/h5p/play/61dbd575a394f50014907539",
    "/h5p/play/61b99471f1306a001544bb87",
];
export const studentReportMockData = {
    materialUrl: materialUrlArr[getRandomNumber(materialUrlArr.length)],
    activityTypeName: activityTypeArr[getRandomNumber(activityTypeArr.length)]
};


export const classAttendeesMockData = (numOfStudents: number): string[] => {
    const userIds: string [] = [];
    for (let i = 0; i < numOfStudents; i++){
        userIds.push(getUniqueId());
    }
    return userIds;
};


