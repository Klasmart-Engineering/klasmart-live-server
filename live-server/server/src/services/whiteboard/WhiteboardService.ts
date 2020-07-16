import { IWhiteboardService } from "./IWhiteboardService";
import { Redis } from "ioredis";
import { RedisKeys } from "../../redisKeys";
import { OperationState } from "./model/OperationState";
import { OperationEvent } from "./events/OperationEvent";
import { redisStreamDeserialize, redisStreamSerialize } from "../../utils";
import { WhiteboardState } from "./model/WhiteboardState";

const OperationExpireSeconds = 60;

export class WhiteboardService implements IWhiteboardService {
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

    async * whiteboardStateStream(roomId: string): AsyncGenerator<{ whiteboardState: WhiteboardState }, void, unknown> {
        const blockingClient = this.client.duplicate();
        const stateKey = RedisKeys.whiteboardState(roomId);
        
        let lastEventId = "0";

        while (true) {
            const response = await blockingClient.xread("BLOCK", 10000, "STREAMS", stateKey, lastEventId);
            if (!response) continue;

            const [[, states]] = response;

            if (states.length === 0) {
                continue;
            }

            lastEventId = states[states.length - 1][0];

            const mostRecentState = states[states.length - 1][1] as any;
            const whiteboardState = redisStreamDeserialize<WhiteboardState>(mostRecentState);

            if (!whiteboardState) {
                continue;
            }

            yield { whiteboardState };
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

    async * whiteboardEventStream(roomId: string): AsyncGenerator<{ whiteboardEvents: OperationEvent[] }, void, unknown> {
        const blockingClient = this.client.duplicate();
        const eventsKey = RedisKeys.whiteboardEvents(roomId);

        let lastEventId = "0";

        while (true) {
            const response = await blockingClient.xread("BLOCK", 10000, "STREAMS", eventsKey, lastEventId);
            if (!response) continue;

            const [[, events]] = response;

            if (events.length === 0) {
                continue;
            }

            lastEventId = events[events.length - 1][0];

            yield { whiteboardEvents: events.map(([,eventValue]) => redisStreamDeserialize<OperationEvent>(eventValue as any)).filter(x => x !== undefined) as OperationEvent[] };
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
}
