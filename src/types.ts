// define interfaces and enums in this file
import {
    KidsloopAuthenticationToken,
    KidsloopLiveAuthorizationToken,
} from 'kidsloop-token-validation';
import WebSocket from 'ws';

export interface Context {
    authenticationToken?: KidsloopAuthenticationToken;
    authorizationToken?: KidsloopLiveAuthorizationToken;
    sessionId?: string;
    roomId?: string;
    websocket?: WebSocket;
    joinTime?: Date;
}
export interface PageEvent {
    sequenceNumber: number;
    isKeyframe: boolean;
    eventsSinceKeyframe: number;
    eventData: string;
}

export interface Session {
    id: string;
    userId: string;
    name: string;
    streamId: string;
    isTeacher: boolean;
    isHost: boolean;
    joinedAt: number;
    email: string;
}

export interface StudentReport {
    classType: string;
    lessonMaterialUrl: string;
    contentType: string;
    actionType: StudentReportActionType;
}

export interface Attendance {
    roomId: string;
    userId: string;
    sessionId: string;
    isTeacher: boolean;
    joinTimestamp: Date;
    leaveTimestamp: Date;
}

export enum ClassType {
    LIVE = `live`,
    CLASSES = `class`,
    STUDY = `study`,
    TASK = `task`
}

export enum StudentReportActionType {
    VIEWED = `viewed`
}
