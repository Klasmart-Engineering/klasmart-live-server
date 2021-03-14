// define interfaces and enums in this file
export interface PageEvent {
    sequenceNumber: number
    isKeyframe: boolean
    eventsSinceKeyframe: number
    eventData: string
}

export interface Session {
    id: string
    name: string
    streamId: string
    isTeacher: boolean
    isHost: boolean
    joinedAt: number
}