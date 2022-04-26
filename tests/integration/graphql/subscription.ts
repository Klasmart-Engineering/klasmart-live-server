import {
    gql
} from "@apollo/client";

export const SUBSCRIPTION_ROOM = gql`
    subscription room($roomId: ID!, $name: String) {
        room(roomId: $roomId, name: $name) {
            message { id, message, session { name, isTeacher } },
            content { type, contentId },
            join { id, name, streamId, isTeacher, isHost, joinedAt },
            leave { id },
            session { webRTC { sessionId, description, ice, stream { name, streamId } } },
            sfu,
            trophy { from, user, kind },
        }
    }
`;

export const SUBSCRIPTION_STREAM = gql`
  subscription stream($streamId: ID!) {
    stream(streamId: $streamId) {
      id,
      event
    }
  }
`;

export const SUBSCRIPTION_WHITEBOARD_EVENTS = gql`
  subscription whiteboardEvents($roomId: ID!) {
    whiteboardEvents(roomId: $roomId) {
      type
      id
      generatedBy
      objectType
      param
    }
  }
`;

export const SUBSCRIPTION_WHITEBOARD_STATE = gql`
  subscription whiteboardState($roomId: ID!) {
      whiteboardState(roomId: $roomId) {
          display
      }
  }`;

export const SUBSCRIPTION_WHITEBOARD_PERMISSIONS = gql`
  subscription whiteboardPermissions($roomId: ID! $userId: ID!) {
      whiteboardPermissions(roomId: $roomId, userId: $userId)
  }`;