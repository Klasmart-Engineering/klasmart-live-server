import { WhiteboardState } from "./model/WhiteboardState";
import { PainterEvent } from "./events/PainterEvent";
import { Context } from "../../main";

export interface IWhiteboardService {
    whiteboardSendEvent(roomId: string, event: string): Promise<boolean>
    whiteboardSendDisplay(roomId: string, display: boolean): Promise<boolean>
    whiteboardSendPermissions(roomId: string, userId: string, permissions: string): Promise<boolean>
    whiteboardEventStream(context: Context, roomId: string): AsyncGenerator<{ whiteboardEvents: PainterEvent[] }, void>
    whiteboardStateStream(context: Context, roomId: string): AsyncGenerator<{ whiteboardState: WhiteboardState }, void, unknown>
    whiteboardPermissionsStream(context: Context, roomId: string, userId: string): AsyncGenerator<{ whiteboardPermissions: string }, void, unknown>
}
