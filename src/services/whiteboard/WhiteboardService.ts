import {RedisKeys} from '../../redisKeys';
import {Context} from '../../types';
import {
  redisStreamDeserialize,
  redisStreamSerialize,
} from '../../utils';
import {PainterEvent} from './events/PainterEvent';
import {IWhiteboardService} from './IWhiteboardService';
import {WhiteboardState} from './model/WhiteboardState';
import {
  Cluster,
  Redis,
} from 'ioredis';
import WebSocket from 'ws';

export class WhiteboardService implements IWhiteboardService {
  constructor(private readonly client: Cluster | Redis) {}

  async whiteboardSendDisplay(roomId: string, display: boolean): Promise<boolean> {
    const whiteboardStateKey = RedisKeys.whiteboardState(roomId);

    const whiteboardState: WhiteboardState = {
      display: display,
      onlyTeacherDraw: true,
    };

    await this.client.expire(whiteboardStateKey.key, whiteboardStateKey.ttl);
    await this.client.xadd(whiteboardStateKey.key, `MAXLEN`, `~`, 1, `*`, ...redisStreamSerialize(whiteboardState));

    return true;
  }

  // TODO: Add type for the permissions instead of passing a string. This will allow the server
  // to verify the permission settings is sane and that the user is actually allowed to mess
  // with the desired permissions.
  async whiteboardSendPermissions(roomId: string, userId: string, permissions: string): Promise<boolean> {
    const permissionsKey = RedisKeys.whiteboardPermissions(roomId, userId);

    await this.client.expire(permissionsKey.key, permissionsKey.ttl);
    await this.client.xadd(permissionsKey.key, `MAXLEN`, `~`, 1, `*`, ...redisStreamSerialize(permissions));

    return true;
  }

  async* whiteboardStateStream(context: Context, roomId: string): AsyncGenerator<{ whiteboardState: WhiteboardState }, void> {
    const stateKey = RedisKeys.whiteboardState(roomId);

    for await (const whiteboardState of this.readMostRecentStreamValue<WhiteboardState>(context, stateKey.key, stateKey.ttl)) {
      yield {
        whiteboardState,
      };
    }
  }

  async* whiteboardPermissionsStream(context: Context, roomId: string, userId: string): AsyncGenerator<{ whiteboardPermissions: string }, void> {
    const permissionsKey = RedisKeys.whiteboardPermissions(roomId, userId);

    for await (const whiteboardPermissions of this.readMostRecentStreamValue<string>(context, permissionsKey.key, permissionsKey.ttl)) {
      yield {
        whiteboardPermissions,
      };
    }
  }

  async whiteboardSendEvent(roomId: string, event: string): Promise<boolean> {
    const painterEvent = JSON.parse(event) as PainterEvent;

    if (painterEvent === undefined) return false;

    // TODO: Ensure user is allowed to do the requested event.

    await this.addPainterEventToStream(roomId, event);

    return true;
  }

  async* whiteboardEventStream({websocket}: Context, roomId: string): AsyncGenerator<{ whiteboardEvents: PainterEvent[] }, void> {
    if (!websocket) {
      throw new Error(`whiteboardEventStream requires a websocket`);
    }
    const blockingClient = this.client.duplicate();
    try {
      const eventsKey = RedisKeys.whiteboardEvents(roomId);

      let lastEventId = `0`;

      while (websocket.readyState === WebSocket.OPEN) {
        await blockingClient.expire(eventsKey.key, eventsKey.ttl);

        const response = await blockingClient.xread(`BLOCK`, 10000, `STREAMS`, eventsKey.key, lastEventId);
        if (!response) continue;

        const [[, events]] = response;

        if (events.length === 0) {
          continue;
        }

        lastEventId = events[events.length - 1][0];

        yield {
          whiteboardEvents: events.map(([, eventValue]) => redisStreamDeserialize<PainterEvent>(eventValue)).filter((x) => x !== undefined) as PainterEvent[],
        };
      }
    } finally {
      blockingClient.disconnect();
    }
  }

  private async addPainterEventToStream(roomId: string, event: string) {
    const eventsKey = RedisKeys.whiteboardEvents(roomId);
    await this.client.expire(eventsKey.key, eventsKey.ttl);

    // TODO: Trim stream length by keeping track of event count since most recent clear (or come up
    // with a different mechanism for trimming the stream).
    await this.client.xadd(eventsKey.key, `*`, `json`, event);
  }

  private async* readMostRecentStreamValue<TResult>({websocket}: Context, key: string, ttl: number): AsyncGenerator<TResult, void> {
    if (!websocket) {
      throw new Error(`whiteboardEventStream requires a websocket`);
    }
    const blockingClient = this.client.duplicate();
    try {
      let lastEventId = `0`;

      while (websocket.readyState === WebSocket.OPEN) {
        await blockingClient.expire(key, ttl);

        const response = await blockingClient.xread(`BLOCK`, 10000, `STREAMS`, key, lastEventId);
        if (!response) continue;

        const [[, streamData]] = response;

        if (streamData.length === 0) {
          continue;
        }

        const lastIndex = streamData.length - 1;
        lastEventId = streamData[lastIndex][0];

        const mostRecentData = streamData[lastIndex][1];
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
