import {
    Cluster,
    KeyType,
    Pipeline as RedisPipeline,
    Redis,
    ValueType,
} from "ioredis";

enum RedisMode {
    NODE,
    CLUSTER
}

/// A mode agnostic interface for dealing with pipelines.  Only uses pipeline when connected to a single redis node.
export class Pipeline {
    private pipeline?: RedisPipeline;
    private readonly mode: RedisMode;
    private results: Array<[Error | null, any]> = [];
    public constructor (private client: Redis | Cluster) {
        if (this.client instanceof Cluster) {
            this.mode = RedisMode.CLUSTER;
            return;
        }

        this.mode = RedisMode.NODE;
        this.pipeline = client.pipeline();
    }

    public async hgetall (key: KeyType): Promise<Pipeline> {
        if (this.mode === RedisMode.CLUSTER) {
            const result = await this.client.hgetall(key);
            this.results.push([ null, result ]);
        } else {
            this.pipeline = this.pipeline?.hgetall(key);
        }
        return this;
    }

    public async hset (key: KeyType, ...args: ValueType[]): Promise<Pipeline> {
        if (this.mode === RedisMode.CLUSTER) {
            const result = await this.client.hset(key, ...args);
            this.results.push([ null, result ]);
        } else {
            this.pipeline = this.pipeline?.hset(key, ...args);
        }
        return this;
    }

    public async expire (key: KeyType, seconds: number): Promise<Pipeline> {
        if (this.mode === RedisMode.CLUSTER) {
            const result = await this.client.expire(key, seconds);
            this.results.push([ null, result ]);
        } else {
            this.pipeline = this.pipeline?.expire(key, seconds);
        }
        return this;
    }

    public async xadd (key: KeyType, id: string, ...args: string[]): Promise<Pipeline> {
        if (this.mode === RedisMode.CLUSTER) {
            const result = await this.client.xadd(key, id, ...args);
            this.results.push([ null, result ]);
        } else {
            this.pipeline = this.pipeline?.xadd(key, id, ...args);
        }
        return this;
    }

    public async del (...keys: KeyType[]): Promise<Pipeline> {
        if (this.mode === RedisMode.CLUSTER) {
            const result = await this.client.del(...keys);
            this.results.push([ null, result ]);
        } else {
            this.pipeline = this.pipeline?.del(...keys);
        }
        return this;
    }

    public async sadd (key: KeyType, ...members: ValueType[]): Promise<Pipeline> {
        if (this.mode === RedisMode.CLUSTER) {
            const result = await this.client.sadd(key, ...members);
            this.results.push([ null, result ]);
        } else {
            this.pipeline = this.pipeline?.sadd(key, ...members);
        }
        return this;
    }

    public async srem (key: KeyType, ...members: ValueType[]): Promise<Pipeline> {
        if (this.mode === RedisMode.CLUSTER) {
            const result = await this.client.srem(key, ...members);
            this.results.push([ null, result ]);
        } else {
            this.pipeline = this.pipeline?.srem(key, ...members);
        }
        return this;
    }

    public async exec (): Promise<Array<[Error | null, any]>> {
        if (this.mode === RedisMode.CLUSTER) {
            return this.results;
        }

        if (!this.pipeline) {
            throw new Error(`Pipeline has no redis pipeline`);
        }
        return this.pipeline.exec();
    }
}
