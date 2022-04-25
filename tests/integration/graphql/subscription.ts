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

export const SUBSCRIPTION_EVENTS = gql`
  subscription stream($streamId: ID!) {
    stream(streamId: $streamId) {
      id,
      event
    }
  }
`;