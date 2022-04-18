import {Context} from "../../types";
import {PainterEvent} from "./events/PainterEvent";
import {WhiteboardState} from "./model/WhiteboardState";

export interface IWhiteboardService {
    whiteboardSendEvent(context: Context, event: string): Promise<boolean>;
    whiteboardSendDisplay(context: Context, display: boolean): Promise<boolean>;
    whiteboardSendPermissions(context: Context, userId: string, permissions: string): Promise<boolean>;
    whiteboardEventStream(context: Context, roomId: string): AsyncGenerator<{ whiteboardEvents: PainterEvent[] }, void>;
    whiteboardStateStream(context: Context, roomId: string): AsyncGenerator<{ whiteboardState: WhiteboardState }, void, unknown>;
    whiteboardPermissionsStream(context: Context, roomId: string, userId: string): AsyncGenerator<{ whiteboardPermissions: string }, void, unknown>;
}
