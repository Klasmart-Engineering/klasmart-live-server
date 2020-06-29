export class RedisKeys {
  public static room (roomId: string): string {
    return `room:${roomId}`
  }

  public static roomContent (roomId: string): string {
    return `${RedisKeys.room(roomId)}:content`
  }

  public static roomNotify (roomId: string): string {
    return `${RedisKeys.room(roomId)}:notify`
  }

  public static roomMessages (roomId: string): string {
    return `${RedisKeys.room(roomId)}:messages`
  }

  public static roomSession (roomId: string, sessionId: string) {
    return `${RedisKeys.room(roomId)}:session:${sessionId}`
  }

  private static roomSessionRegex = /^room:(.*):session:(.*)$/
  public static parseRoomSession (key: string) {
    const results = key.match(this.roomSessionRegex)
    if (!results) { return }
    if (results.length !== 3) { return }
    return { roomId: results[1], sessionId: results[2] }
  }

  public static streamEvents (streamId: string): string {
    return `stream:${streamId}:events`
  }
}
