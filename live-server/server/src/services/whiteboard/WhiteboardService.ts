import { Redis } from "ioredis";
import { RedisKeys } from "../../redisKeys";
import { PainterEvent } from "./events/PainterEvent";
import { redisStreamDeserialize, redisStreamSerialize } from "../../utils";
import { WhiteboardState } from "./model/WhiteboardState";
import { Context } from "../../main";
import WebSocket from "ws";
import { IWhiteboardService } from "./IWhiteboardService";

export class WhiteboardService implements IWhiteboardService {
    readonly client: Redis

    constructor(client: Redis) {
        this.client = client;
    }

    async whiteboardSendDisplay(roomId: string, display: boolean): Promise<boolean> {
        const whiteboardStateKey = RedisKeys.whiteboardState(roomId);

        const whiteboardState: WhiteboardState = {
            display: display,
            onlyTeacherDraw: true,
        };

        await this.client.xadd(whiteboardStateKey, "MAXLEN", "~", 1, "*", ...redisStreamSerialize(whiteboardState));

        return true;
    }

    // TODO: Add type for the permissions instead of passing a string. This will allow the server
    // to verify the permission settings is sane and that the user is actually allowed to mess
    // with the desired permissions.
    async whiteboardSendPermissions(roomId: string, userId: string, permissions: string): Promise<boolean> {
        const whiteboardPermissionsKey = RedisKeys.whiteboardPermissions(roomId, userId);

        await this.client.xadd(whiteboardPermissionsKey, "MAXLEN", "~", 1, "*", ...redisStreamSerialize(permissions));

        return true;
    }

    async * whiteboardStateStream(context: Context, roomId: string): AsyncGenerator<{ whiteboardState: WhiteboardState }, void, unknown> {
        const stateKey = RedisKeys.whiteboardState(roomId);

        for await (const whiteboardState of this.readMostRecentStreamValue<WhiteboardState>(context, stateKey)) {
            yield { whiteboardState };
        }
    }

    async * whiteboardPermissionsStream(context: Context, roomId: string, userId: string): AsyncGenerator<{ whiteboardPermissions: string }, void, unknown> {
        const permissionsKey = RedisKeys.whiteboardPermissions(roomId, userId);

        for await (const whiteboardPermissions of this.readMostRecentStreamValue<string>(context, permissionsKey)) {
            yield { whiteboardPermissions };
        }
    }

    async whiteboardSendEvent(roomId: string, event: string): Promise<boolean> {
        const painterEvent = JSON.parse(event) as PainterEvent;

        if (painterEvent === undefined) return false;

        // TODO: Ensure user is allowed to do the requested event.

        await this.addPainterEventToStream(roomId, event);

        return true;
    }

    async * whiteboardEventStream({ websocket }: Context, roomId: string): AsyncGenerator<{ whiteboardEvents: PainterEvent[] }, void, unknown> {
        const blockingClient = this.client.duplicate();
        try {
            const eventsKey = RedisKeys.whiteboardEvents(roomId);

            let lastEventId = "0";

            while (websocket.readyState === WebSocket.OPEN) {
                const response = await blockingClient.xread("BLOCK", 10000, "STREAMS", eventsKey, lastEventId);
                if (!response) continue;

                const [[, events]] = response;

                if (events.length === 0) {
                    continue;
                }

                lastEventId = events[events.length - 1][0];

                yield { whiteboardEvents: events.map(([, eventValue]) => redisStreamDeserialize<PainterEvent>(eventValue as any)).filter(x => x !== undefined) as PainterEvent[] };
            }
        } finally {
            blockingClient.disconnect();
        }
    }

    private async addPainterEventToStream(roomId: string, event: string) {
        const whiteboardEventsKey = RedisKeys.whiteboardEvents(roomId);

        // TODO: Trim stream length by keeping track of event count since most recent clear (or come up
        // with a different mechanism for trimming the stream).
        await this.client.xadd(whiteboardEventsKey, "*", "json", event);
    }

    private async * readMostRecentStreamValue<TResult>({ websocket }: Context, key: string): AsyncGenerator<TResult, void, unknown> {
        const blockingClient = this.client.duplicate();
        try {
            let lastEventId = "0";

            while (websocket.readyState === WebSocket.OPEN) {
                const response = await blockingClient.xread("BLOCK", 10000, "STREAMS", key, lastEventId);
                if (!response) continue;

                const [[, streamData]] = response;

                if (streamData.length === 0) {
                    continue;
                }

                const lastIndex = streamData.length - 1;
                lastEventId = streamData[lastIndex][0];

                const mostRecentData = streamData[lastIndex][1] as any;
                const item = redisStreamDeserialize<TResult>(mostRecentData);

                if (!item) {
                    continue;
                }

                yield item;
            }
        } finally {
            blockingClient.disconnect();
        }
    }
}
