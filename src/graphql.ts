import { gql } from "graphql-request";

export const SAVE_ATTENDANCE_MUTATION = gql`
  mutation saveAttendance($userId: String!, $leaveTimestamp: DateTime!, $joinTimestamp: DateTime!, $sessionId: String!, $roomId: String!) {
    saveAttendance(userId: $userId, leaveTimestamp: $leaveTimestamp, joinTimestamp: $joinTimestamp, sessionId: $sessionId, roomId: $roomId) {
      roomId,
      userId,
      sessionId,
      joinTimestamp,
      leaveTimestamp,
    }
}`;

export const GET_ATTENDACE_QUERY = gql`
  query Query($roomId: String!) {
    getClassAttendance(roomId: $roomId) {
      roomId
      userId
      sessionId
      joinTimestamp
      leaveTimestamp
    }
  }
`;
