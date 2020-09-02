import { Redis } from "ioredis";
import { RedisKeys } from "../../redisKeys";
import { OperationState } from "./model/OperationState";
import { OperationEvent } from "./events/OperationEvent";
import { redisStreamDeserialize, redisStreamSerialize } from "../../utils";
import { WhiteboardState } from "./model/WhiteboardState";
import { Context } from "../../main";
import WebSocket from "ws";



const OperationExpireSeconds = 60;

export class WhiteboardService {
    readonly client: Redis

    constructor (client: Redis) {
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

    async whiteboardSendEvent (roomId: string, event: string): Promise<boolean> {
        const painterEvent = JSON.parse(event) as OperationEvent;
        const operationId = painterEvent.id;

        if (painterEvent === undefined) return false;

        if (painterEvent.type === "beginOperation") {
            if (!await this.operationBegin(roomId, operationId)) {
                return false;
            }

            await this.addPainterEventToStream(roomId, event);
        } else if (painterEvent.type === "endOperation") {
            if (!await this.operationEnd(roomId, operationId)) {
                return false;
            }

            await this.addPainterEventToStream(roomId, event);
        } else {
            const operationKey = RedisKeys.whiteboardOperation(roomId, operationId);

            // TODO: Perhaps we should implement some operations cache, to prevent having
            // to hit redis on each event. There could be multiple events each second
            // unless we implement batching or another solution to remedy that.
            const operationJson = await this.client.get(operationKey);
            if (operationJson !== null) {
                // TODO: Ensure the user own this operation.
                // const operation = JSON.parse(operationJson)

                // NOTE: Refresh the operation expire time.
                await this.client.expire(operationKey, OperationExpireSeconds);
            }

            // TODO: Ensure user is allowed to do the requested event.

            await this.addPainterEventToStream(roomId, event);
        }

        return true;
    }

    async * whiteboardEventStream({websocket}: Context, roomId: string): AsyncGenerator<{ whiteboardEvents: OperationEvent[] }, void, unknown> {
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

                yield { whiteboardEvents: events.map(([,eventValue]) => redisStreamDeserialize<OperationEvent>(eventValue as any)).filter(x => x !== undefined) as OperationEvent[] };
            }
        } finally {
            blockingClient.disconnect();
        }
    }

    private async operationBegin (roomId: string, id: string): Promise<boolean> {
        // TODO: Ensure the user is participating in the room.
        // TODO: Ensure this user is allowed to do whiteboard operations.
        // TODO: Ensure this user doesn't have any other ongoing operations.

        const operationState: OperationState = {
            id: id,
            room: roomId,
            user: "" // TODO: Assign userId/sessionId
        };

        const operationKey = RedisKeys.whiteboardOperation(roomId, id);

        const existingOperation = await this.client.get(operationKey);
        if (existingOperation !== null) return false;

        // NOTE: Set the operation state with expire time of one minute.
        await this.client.set(operationKey, JSON.stringify(operationState), "EX", OperationExpireSeconds);

        // TODO: How to insert operationEnd event in stream in case the operation is expired?
        // Can probably be done with keyspace notifications:
        // redis keyspace notifications: https://redis.io/topics/notifications
        // js pub/sub example: https://github.com/NodeRedis/node-redis/blob/master/examples/pub_sub.js
        // NOTE from Owen: The pub/sub feature in redis doesn't scale well, so we should avoid it.

        return true;
    }

    private async operationEnd (roomId: string, id: string): Promise<boolean> {
        const operationKey = RedisKeys.whiteboardOperation(roomId, id);

        const operationJson = await this.client.get(operationKey);
        if (operationJson === null) return false;

        // TODO: Ensure the user own this operation.
        // const operation = JSON.parse(operationJson)

        await this.client.del(operationKey);

        return true;
    }

    private async addPainterEventToStream(roomId: string, event: string) {
        const whiteboardEventsKey = RedisKeys.whiteboardEvents(roomId);

        // TODO: Trim stream length by keeping track of event count since most recent clear (or come up
        // with a different mechanism for trimming the stream).
        await this.client.xadd(whiteboardEventsKey, "*", "json", event);
    }

    private async * readMostRecentStreamValue<TResult>({ websocket }: Context, key: string) : AsyncGenerator<TResult, void, unknown> {
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
