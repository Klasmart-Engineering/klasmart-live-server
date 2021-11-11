import { gql } from "apollo-server-express";
import { typeDefs as typeDef } from "graphql-scalars";

const customSchema = gql`
  type Query {
    ready: Boolean
    sfuAddress(roomId: ID!): String
    token: Token
  }

  type Mutation {
    endClass: Boolean,
    leaveClass: Boolean,
    setSessionStreamId(roomId: ID!, streamId: ID!): Boolean
    setHost(roomId: ID!, nextHostId: ID!): Boolean
    showContent(roomId: ID!, type: ContentType!, contentId: ID): Boolean
    sendMessage(roomId: ID!, message: String): Message
    postPageEvent(streamId: ID!, pageEvents: [PageEventIn]): Boolean
    webRTCSignal(roomId: ID!, toSessionId: ID!, webrtc: WebRTCIn): Boolean
    whiteboardSendEvent(roomId: ID!, event: String) : Boolean
    whiteboardSendDisplay(roomId: ID!, display: Boolean): Boolean
    whiteboardSendPermissions(roomId: ID!, userId: ID!, permissions: String): Boolean
    mute(roomId: ID!, sessionId: ID!, audio: Boolean, video: Boolean): Boolean
    video(roomId: ID!, sessionId: ID!, src: String, play: Boolean, offset: Float): Boolean
    rewardTrophy(roomId: ID!, user: ID!, kind: String): Boolean
    saveFeedback(stars: Int!, feedbackType: FeedbackType!, comment: String, quickFeedback: [QuickFeedbackInput]): Boolean
    studentReport(roomId: ID!, , materialUrl: String, activityTypeName:String): Boolean
  }

  type Subscription {
    room(roomId: ID!, name: String): RoomNotification
    stream(streamId: ID!, from: ID): PageEventOut
    video(roomId: ID!, sessionId: ID!): VideoSynchronize
    whiteboardState(roomId: ID!): WhiteboardStateOut
    whiteboardPermissions(roomId: ID!, userId: ID!): String
    whiteboardEvents(roomId: ID!): [WhiteboardEventOut]
  }

  type RoomNotification {
    message: Message
    join: Session
    leave: Session
    content: Content
    session: SessionNotification
    trophy: TrophyNotification
    sfu: String
  }

  type TrophyNotification {
    from: ID
    user: ID
    kind: String
  }

  type SessionNotification {
    webRTC: WebRTC
  }

  input StreamNameIn {
    name: String,
    streamId: ID!
  }
  input WebRTCIn {
    description: String
    ice: String
    stream: StreamNameIn
  }

  type StreamName {
    name: String,
    streamId: ID!
  }
  type WebRTC {
    sessionId: ID!
    description: String
    ice: String
    stream: StreamName
  }

  type Session {
    id: ID!,
    name: String,
    streamId: ID
    isTeacher: Boolean
    isHost: Boolean
    joinedAt: Timestamp
  }

  enum ContentType {
    Blank,
    Stream,
    Activity,
    Video,
    Audio,
    Image,
    Camera,
    Screen,
  }

  type Content {
    type: ContentType!,
    contentId: ID
  }
  
  type Message {
    id: ID!
    session: Session
    message: String
  }

  type Token {
    subject: String
    audience: String
    userId: String
    userName: String
    isTeacher: Boolean
    organization: String
    roomId: String
    materials: [Material]
  }

  type Material {
    name: String
    url: String
  }

  input PageEventIn {
    sequenceNumber: Int
    isKeyframe: Boolean
    eventsSinceKeyframe: Int
    eventData: String!
  }

  type PageEventOut {
    id: ID!
    index: Int
    checkout: Boolean
    event: String!
  }

  type WhiteboardStateOut {
    display: Boolean
    onlyTeacherDraw: Boolean
  }

  type WhiteboardEventOut {
    type: String
    id: String
    generatedBy: String
    objectType: String
    param: String
  }

  type VideoSynchronize {
    src: String
    play: Boolean
    offset: Float
  }

  enum FeedbackType {
    END_CLASS
    LEAVE_CLASS
  }

  enum QuickFeedbackType {
    VIDEO
    AUDIO
    PRESENTATION
    OTHER
  }

  input QuickFeedbackInput {
    type: QuickFeedbackType
    stars: Int
  }
`;

export const typeDefs = typeDef.map(typeDef => gql`${typeDef}`).concat(customSchema);