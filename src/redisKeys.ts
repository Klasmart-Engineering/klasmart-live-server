export class RedisKeys {
  private static room(roomId: string): string {
    return `room:{${roomId}}`;
  }

  private static user(userId: string): string {
    return `user:{${userId}}`;
  }

  public static roomHost(roomId: string) {
    return {
      key: `${RedisKeys.room(roomId)}:host`,
      ttl: 3600,
    };
  }
  public static roomContent(roomId: string) {
    return {
      key: `${RedisKeys.room(roomId)}:content`,
      ttl: 3600,
    };
  }

  public static roomNotify(roomId: string) {
    return {
      key: `${RedisKeys.room(roomId)}:notify`,
      ttl: 3600,
    };
  }

  public static roomMessages(roomId: string) {
    return {
      key: `${RedisKeys.room(roomId)}:messages`,
      ttl: 3600,
    };
  }

  public static roomSfu(roomId: string) {
    return {
      key: `${RedisKeys.room(roomId)}:sfu`,
      ttl: 3600,
    };
  }

  private static session(roomId: string, sessionId: string): string {
    return `${RedisKeys.room(roomId)}:session:${sessionId}`;
  }

  public static sessionData(roomId: string, sessionId: string) {
    return `${RedisKeys.session(roomId, sessionId)}:data`;
  }

  public static roomSessions(roomId: string) {
    return `${RedisKeys.room(roomId)}:sessions`;
  }

  public static activityType(roomId: string) {
    return {
      key: `${RedisKeys.room(roomId)}:type`,
      ttl: 3600,
    };
  }

  public static sfuRequest() {
    return `sfu:request`;
  }

  public static sessionNotify(roomId: string, sessionId: string) {
    return `${RedisKeys.session(roomId, sessionId)}:notify`;
  }

  public static whiteboardEvents(roomId: string) {
    return {
      key: `${RedisKeys.room(roomId)}:whiteboard:events`,
      ttl: 3600,
    };
  }

  public static whiteboardState(roomId: string) {
    return {
      key: `${RedisKeys.room(roomId)}:whiteboard:state`,
      ttl: 3600,
    };
  }

  public static whiteboardPermissions(roomId: string, userId: string) {
    return {
      key: `${RedisKeys.room(roomId)}:${RedisKeys.user(userId)}:whiteboard:permissions`,
      ttl: 3600,
    };
  }

  private static sessionDataKeyRegex = /^room:(.*):session:(.*):data$/;
  public static parseSessionDataKey(key: string) {
    const results = key.match(this.sessionDataKeyRegex);
    if (!results) {
      return;
    }
    if (results.length !== 3) {
      return;
    }
    return {
      roomId: results[1],
      sessionId: results[2],
    };
  }

  public static streamEvents(streamId: string): string {
    return `stream:${streamId}:events`;
  }

  public static video(roomId: string, sessionId: string) {
    return `${RedisKeys.session(roomId, sessionId)}:video`;
  }

  public static videoState(roomId: string, sessionId: string) {
    return {
      key: `${RedisKeys.video(roomId, sessionId)}:state`,
      ttl: 3600,
    };
  }

  public static videoStateChanges(roomId: string, sessionId: string) {
    return {
      key: `${RedisKeys.video(roomId, sessionId)}:changes`,
      ttl: 3600,
    };
  }

  public static isTepmStorageLocked() {
    return `isTepmStorageLocked`;
  }

  public static tempStorageKeys() {
    return `tempStorage`;
  }

  public static tempStorageKey(id: string) {
    return `${RedisKeys.tempStorageKeys()}:${id}`;
  }

  public static lastKeyframe(streamId: string) {
    return `lastKeyframe: ${streamId}`;
  }

  public static roomContext(roomId: string) {
    return `roomContext:${roomId}`;
  }
}
