// define interfaces and enums in this file
import {
    KidsloopAuthenticationToken,
    KidsloopLiveAuthorizationToken,
} from "@kl-engineering/kidsloop-token-validation";
import WebSocket from "ws";

/** INTERFACE */
export interface Context {
    authenticationToken?: KidsloopAuthenticationToken;
    authorizationToken: KidsloopLiveAuthorizationToken;
    sessionId: string;
    roomId?: string;
    websocket: WebSocket;
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
export interface Attendance {
    roomId: string;
    userId: string;
    sessionId: string;
    isTeacher: boolean;
    joinTimestamp: Date;
    leaveTimestamp: Date;
}

export interface StudentReport {
    classType: string;
    lessonMaterialUrl: string;
    contentType: string;
    actionType: StudentReportActionType;
}

/** TYPES */

export type Message = {
    id: string,
    session: Session,
    message: string,
}

export type Student = {
    user_id: string;
    email: string;
    name: string;
}

export type StudentReportRequestType = {
    room_id: string;
    class_type: string;
    lesson_material_url: string;
    content_type: string;
    action_type: StudentReportActionType;
    timestamp: number;
    students: Student[];
}

export type AttendanceRequestType = {
    action: string,
    attendance_ids: string [],
    class_end_time: number,
    class_length: number,
    schedule_id: string,
}
export type SFUEntry = {
    sfuAddress: string;
}

export type RoomContext = {
    classType: ClassType;
    startAt: number;
    endAt: number;
}

export type NotifyRoomType =
    { content: ContentMessageType } |
    { join: Session } |
    { leave: Session } |
    { mute: MuteMessageType } |
    { trophy: TrophMessageType };

export type ContentMessageType = {
    type: string;
    contentId?: string;
}

export type MuteMessageType = {
    sessionId: string;
    audio?: boolean;
    video?: boolean;
}

export type TrophMessageType = {
    from: string;
    user: string;
    kind: string;
}

/** ENUM */
export enum ClassType {
    LIVE = "live",
    CLASS = "class",
    STUDY = "study",
    TASK = "task"
}

export enum StudentReportActionType {
    VIEWED = "viewed"
}

export enum ConnectionType {
    GRAPHQL_TRANSPORT_WS_PROTOCOL = "graphql-transport-ws",
    GRAPHQL_WS = "graphql-ws"
}
