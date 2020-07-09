export class RedisKeys {
    private static room (roomId: string): string {
        return `room:${roomId}`;
    }

    public static roomContent (roomId: string) {
        return { key: `${RedisKeys.room(roomId)}:content`, ttl: 3600 };
    }

    public static roomNotify (roomId: string) {
        return { key: `${RedisKeys.room(roomId)}:notify`, ttl: 3600 };
    }

    public static roomMessages (roomId: string) {
        return { key: `${RedisKeys.room(roomId)}:messages`, ttl: 3600 };
    }

    private static session (roomId: string, sessionId: string): string {
        return `${RedisKeys.room(roomId)}:session:${sessionId}`;
    }

    public static sessionData (roomId: string, sessionId: string) {
        return `${RedisKeys.session(roomId, sessionId)}:data`;
    }

    public static sessionNotify (roomId: string, sessionId: string) {
        return `${RedisKeys.session(roomId, sessionId)}:notify`;
    }

  private static sessionDataKeyRegex = /^room:(.*):session:(.*):data$/
  public static parseSessionDataKey (key: string) {
      const results = key.match(this.sessionDataKeyRegex);
      if (!results) { return; }
      if (results.length !== 3) { return; }
      return { roomId: results[1], sessionId: results[2] };
  }

  public static streamEvents (streamId: string): string {
      return `stream:${streamId}:events`;
  }
}
