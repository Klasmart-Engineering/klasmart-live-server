import { EventType } from "./EventType";

export interface OperationEvent {
    type: EventType
    id: string
    param?: string
}
