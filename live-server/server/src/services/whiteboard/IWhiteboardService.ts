import { OperationEvent } from "./events/OperationEvent";

export interface IWhiteboardService {
    whiteboardSendEvent(roomId: string, event: string) : Promise<boolean>
    whiteboardEventStream(roomId: string) : AsyncGenerator<{whiteboardEvents: OperationEvent}, void>
}
