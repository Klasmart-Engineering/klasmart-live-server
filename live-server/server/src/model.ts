import { fromRedisKeyValueArray, redisStreamDeserialize, redisStreamSerialize } from './utils'
import { RedisKeys } from './redisKeys'
import Redis = require('ioredis')

interface PageEvent {
  sequenceNumber: number
  isKeyframe: boolean
  eventsSinceKeyframe: number
  eventData: string
}

export class Model {
  public static async create () {
    const redis = new Redis({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT) || undefined,
      lazyConnect: true
    })
    await redis.connect()
    console.log('🔴 Redis database connected')
    return new Model(redis)
  }

    private client: Redis.Redis
    private constructor (client: Redis.Redis) {
      this.client = client
    }

    public async getSession (roomId: string, sessionId: string) {
      const sessionKey = RedisKeys.roomSession(roomId, sessionId)
      const sessionKeyValues = await this.client.hgetall(sessionKey)
      return { ...sessionKeyValues }
    }

    public async setSessionStreamId (roomId: string, sessionId: string, streamId: string) {
      const sessionKey = RedisKeys.roomSession(roomId, sessionId)
      await this.client.pipeline()
        .hset(sessionKey, 'id', sessionId)
        .hset(sessionKey, 'streamId', streamId)
        .expire(sessionKey, 600)
        .exec()
      const session = await this.getSession(roomId, sessionId)
      this.notifyRoom(roomId, { join: session })
    }

    public async showContent (roomId: string, type: string, contentId?: string) {
      const key = RedisKeys.roomContent(roomId)
      const content = { type, contentId }
      await this.notifyRoom(roomId, { content })
      await this.client.set(key, JSON.stringify(content))
    }

    public async postPageEvent (streamId: string, pageEvents: PageEvent[]) {
      const key = RedisKeys.streamEvents(streamId)
      const pipeline = this.client.pipeline()

      for (const {eventsSinceKeyframe, isKeyframe, eventData } of pageEvents) {
        
        pipeline.xadd(
          key,
          'MAXLEN', '~', (eventsSinceKeyframe + 1).toString(),
          '*',
          'i', eventsSinceKeyframe.toString(),
          'c', isKeyframe.toString(),
          'e', eventData
        )
      }
      pipeline.expire(key, 60)
      const result = await pipeline.exec()
      return result.every(([e]) => e == null)
    }

    public async sendMessage (roomId: string, sessionId: string, message: string) {
      if (!roomId) { throw new Error(`Invalid roomId('${roomId}')`) }
      message = message.trim()
      if (message.length > 1024) { message = `${message.slice(0, 1024).trim()}...` }
      if (!message) { return }
      // TODO: Pipeline these opperations
      const key = RedisKeys.roomMessages(roomId)
      const session = await this.getSession(roomId, sessionId)
      const id = await this.client.xadd(key, 'MAXLEN', '~', 32, '*', 'json', JSON.stringify({ session, message }))
      await this.client.expire(key, 24 * 60 * 60)
      return { id, session, message }
    }

    public disconnect (context: any) {
      if (context.sessionId) { this.userLeave(context.sessionId) }
      console.log(`Disconnect: ${JSON.stringify(context.sessionId)}`)
    }

    public async * room (roomId: string, sessionId: string, name?: string) {
      // TODO: Pipeline initial opperations
      await this.userJoin(roomId, sessionId, name)

      // Get room's last contents or supply default blank value
      try {
        const contentKey = RedisKeys.roomContent(roomId)
        const contentJSON = await this.client.get(contentKey)
        if (contentJSON) {
          const content = JSON.parse(contentJSON)
          yield { room: { content } }
        } else {
          yield { room: { content: { type: 'Blank' } } }
        }
      } catch (e) {
        yield { room: { content: { type: 'Blank' } } }
      }

      // Get all the sessions within a room
      {
        const sessionSearchKey = RedisKeys.roomSession(roomId, '*')
        let sessionSearchCursor = '0'
        do {
          const [newCursor, keys] = await this.client.scan(sessionSearchCursor, 'MATCH', sessionSearchKey)
          const pipeline = this.client.pipeline()
          for (const key of keys) { pipeline.hgetall(key) }
          const sessions = await pipeline.exec()

          for (const [, session] of sessions) {
            yield { room: { join: session } }
          }
          sessionSearchCursor = newCursor
        } while (sessionSearchCursor !== '0')
      }

      // Get room's last messages
      const messagesKey = RedisKeys.roomMessages(roomId)
      let lastMessageIndex = '0'

      // Get notifications
      const notifyKey = RedisKeys.roomNotify(roomId)
      let lastNotifyIndex = '$'

      // Send updates
      const client = this.client.duplicate()
      try {
        while (true) {
          const responses = await client.xread(
            'BLOCK', 0,
            'STREAMS',
            messagesKey, notifyKey,
            lastMessageIndex, lastNotifyIndex
          )
          if (!responses) { continue }
          for (const [key, messages] of responses) {
            switch (key) {
              case notifyKey:
                for (const [id, keyValues] of messages) {
                  lastNotifyIndex = id
                  yield { room: { ...redisStreamDeserialize<any>(keyValues as any) } }
                }
                break
              case messagesKey:
                for (const [id, keyValues] of messages) {
                  lastMessageIndex = id
                  yield { room: { message: { id, ...redisStreamDeserialize<any>(keyValues as any) } } }
                }
                break
            }
          }
        }
      } finally {
        client.disconnect()
      }
    }

    public async * stream (streamId: string, from:string) {
      const key = RedisKeys.streamEvents(streamId)
      if (!from) { from = '0' }
      const client = this.client.duplicate() // We will block
      try {
        while (true) {
          const response = await client.xread('BLOCK', 0, 'STREAMS', key, from)
          if (!response) { continue }
          const [[, messages]] = response
          for (const [id, keyValues] of messages) {
          // ioredis's types definitions are incorrect
          // keyValues is of type string[], e.g. [key1, value1, key2, value2, key3, value3...]
            from = id
            const m = fromRedisKeyValueArray(keyValues as any)
            yield {
              stream: {
                id,
                index: Number(m.i) || undefined,
                checkout: Boolean(m.c),
                event: m.e
              }
            }
          }
        }
      } finally {
        client.disconnect()
      }
    }

    private async notifyRoom (roomId:string, message: any): Promise<string> {
      return await this.client.xadd(
        RedisKeys.roomNotify(roomId),
        'MAXLEN', '~', 32, '*',
        ...redisStreamSerialize(message)
      )
    }

    private async userJoin (roomId: string, sessionId: string, name?: string) {
      const sessionKey = RedisKeys.roomSession(roomId, sessionId)
      await this.client.hmset(sessionKey, 'id', sessionId)
      if (name) { await this.client.hmset(sessionKey, 'name', name) }
      await this.client.expire(sessionKey, 60)
      await this.notifyRoom(roomId, { join: { id: sessionId, name } })
    }

    private async userLeave (sessionId: string) {
      const sessionSearchKey = RedisKeys.roomSession('*', sessionId)
      let sessionSearchCursor = '0'
      let count = 0
      const pipeline = this.client.pipeline()
      do {
        const [newCursor, keys] = await this.client.scan(sessionSearchCursor, 'MATCH', sessionSearchKey)
        for (const key of keys) {
          const params = RedisKeys.parseRoomSession(key)
          if (!params) { continue }
          count++
          pipeline.del(key)
          pipeline.xadd(
            RedisKeys.roomNotify(params.roomId),
            'MAXLEN', '~', (32 + count).toString(), '*',
            ...redisStreamSerialize({ leave: { id: params.sessionId } })
          )
        }
        sessionSearchCursor = newCursor
      } while (sessionSearchCursor !== '0')
      await pipeline.exec()
    }

    private async getStreamsLastGeneratedId (key: string): Promise<string> {
      try {
        const info = await this.client.xinfo('STREAM', key)
        return info[8]
      } catch (e) {
        return '$'
      }
    }

    private async duplicateClient<T> (f:(client: Redis.Redis) => Promise<T>): Promise<T> {
      const client = this.client.duplicate()
      try {
        return await f(client)
      } finally {
        client.disconnect()
      }
    }
}
