import { Session } from "./types";

export function redisStreamDeserialize<T> (keyValues: string[]): T | undefined {
    for (let i = 0; i + 1 < keyValues.length; i += 2) {
        try {
            if (keyValues[i] === `json`) { return JSON.parse(keyValues[i + 1]); }
        } catch (e) {
            console.error(e);
        }
    }
    return undefined;
}

export function redisStreamSerialize (value: any): ["json", string] {
    return [ `json`, JSON.stringify(value) ];
}

export async function * mapAsync<T, U> (collection: AsyncIterable<T>, f: (item: T) => U) {
    for await (const b of collection) {
        yield f(b);
    }
}

// Takes an array of form [k1, v1, k2, v2, ...]
// Returns an object of the form {k1: v1, k2: v2, ...}
export function fromRedisKeyValueArray (keyValues: string[]) {
    const result: any = {};
    for (let i = 0; i + 1 < keyValues.length; i += 2) {
        result[keyValues[i]] = keyValues[i + 1];
    }
    return result;
}

// take an object of the form {k1: v1, k2: v2, ...}
// Returns an array of form [k1.toString(), v1.toString(), k2.toString(), v2.toString(), ...]
export function toRedisKeyValueArray (obj: Record<any, any>): string[] {
    const result: string[] = [];
    for (const key in obj) {
        if (obj[key] !== undefined) {
            result.push(key.toString(), obj[key].toString());
        }
    }
    return result;
}

export function convertSessionRecordToSession (session: Record<string, string>): Session {
    return {
        id: session.id,
        userId: session.userId,
        name: session.name,
        streamId: session.streamId,
        email: session.email,
        isTeacher: session.isTeacher === `true`,
        isHost: session.isHost === `true`,
        joinedAt: Number(session.joinedAt),
    } as Session;
}
