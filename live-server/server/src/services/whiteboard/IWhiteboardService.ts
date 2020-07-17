import { OperationEvent } from "./events/OperationEvent";
import { WhiteboardState } from "./model/WhiteboardState";

export interface IWhiteboardService {
    whiteboardSendEvent(roomId: string, event: string) : Promise<boolean>
    whiteboardSendDisplay(roomId: string, display: boolean): Promise<boolean>
    whiteboardSendPermissions(roomId: string, userId: string, permissions: string): Promise<boolean>
    whiteboardEventStream(roomId: string) : AsyncGenerator<{whiteboardEvents: OperationEvent[]}, void>
    whiteboardStateStream(roomId: string): AsyncGenerator<{whiteboardState: WhiteboardState}, void, unknown>
    whiteboardPermissionsStream(roomId: string, userId: string): AsyncGenerator<{whiteboardPermissions: string}, void, unknown>
}
