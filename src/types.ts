// define interfaces and enums in this file
export interface PageEvent {
    sequenceNumber: number
    isKeyframe: boolean
    eventsSinceKeyframe: number
    eventData: string
}

export interface Session {
    id: string
    userId: string
    name: string
    streamId: string
    isTeacher: boolean
    isHost: boolean
    joinedAt: number,
    email: string,
}

export interface StudentReport {
    classType: string,
    lessonMaterialUrl: string,
    contentType: string,
    actionType: StudentReportActionType
}

export enum ClassType {
    LIVE = "live",
    CLASSES = "class",
    STUDY = "study",
    TASK = "task"
}

export enum StudentReportActionType {
    VIEWED = "viewed"
}