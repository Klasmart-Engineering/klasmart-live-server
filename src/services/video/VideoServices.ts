import Redis from "ioredis";
import { Cluster } from "ioredis";
import WebSocket from "ws";
import {Base} from "../base";
import {RedisKeys} from "../../redisKeys";
import { Context } from "../../types";
import {
    redisStreamDeserialize,
} from "../../utils";

export class VideoServices extends Base {
    constructor(readonly client: Cluster | Redis) {
        super(client);
    }

    public async startVideoStream(context: Context, sessionId: string, src?: string, play?: boolean, offset?: number): Promise<boolean> {
        if (src === undefined && play === undefined && offset === undefined) {
            return true;
        }
        const roomId = context.authorizationToken.roomid;
        const timePromise = this.getTime();
        const pipeline = this.client.pipeline();
        const state = RedisKeys.videoState(roomId, sessionId);
        pipeline.expire(state.key, state.ttl);
        const stream = RedisKeys.videoStateChanges(roomId, sessionId);
        pipeline.expire(stream.key, stream.ttl);

        if (src !== undefined) {
            pipeline.hset(state.key, "src", src);
        }
        if (play !== undefined) {
            pipeline.hset(state.key, "play", play ? "true" : "");
        }
        if (offset !== undefined) {
            pipeline.hset(state.key, "offset", offset);
        }

        const time = await timePromise;
        pipeline.hset(state.key, "time", time);
        pipeline.xadd(stream.key, "MAXLEN", "~", "32", "*", "json", JSON.stringify({
            src,
            play,
            time,
            offset,
        }));
        await pipeline.exec();

        return true;
    }

    public async* subscribeToVideo(context: Context, sessionId: string) {
        const { websocket } = context;
        const roomId = context.authorizationToken.roomid;
        if (!websocket) {
            throw new Error("Can't subscribe to a video notifications without a websocket");
        }
        const video = RedisKeys.videoState(roomId, sessionId);
        {
            const state = await this.client.hgetall(video.key);
            const play = Boolean(state["play"]);
            let offset = Number(state["offset"]);
            if (play) {
                const delta = (await this.getTime()) - Number(state["time"]);
                offset += delta || 0;
            }
            yield {
                video: {
                    src: state["src"],
                    play,
                    offset,
                },
            };
        }
        const stream = RedisKeys.videoStateChanges(roomId, sessionId);
        let from = "$";
        const client = this.client.duplicate(); // We will block
        try {
            while (websocket.readyState === WebSocket.OPEN) {
                await client
                    .pipeline()
                    .expire(video.key, video.ttl)
                    .expire(stream.key, stream.ttl)
                    .exec();
                const response = await client.xread("BLOCK", 10000, "STREAMS", stream.key, from);
                if (!response) {
                    continue;
                }
                const [[, messages]] = response;
                // TODO: optimize to only send most recent message
                for (const [id, keyValues] of messages) {
                    from = id;
                    const state = redisStreamDeserialize<any>(keyValues);
                    const delta = (await this.getTime()) - Number(state["time"]);
                    const offset = Number(state["offset"]) + delta;
                    yield {
                        video: {
                            src: state["src"],
                            play: Boolean(state["play"]),
                            offset: Number.isFinite(offset) ? offset : undefined,
                        },
                    };
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            client.disconnect();
        }
    }
}
