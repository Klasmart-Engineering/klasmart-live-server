import {gql} from "graphql-request";

export const SAVE_ATTENDANCE_MUTATION = gql`
  mutation saveAttendance($userId: String!, $leaveTimestamp: DateTime!, $joinTimestamp: DateTime!, $isTeacher: Boolean!, $sessionId: String!, $roomId: String!) {
    saveAttendance(userId: $userId, leaveTimestamp: $leaveTimestamp, joinTimestamp: $joinTimestamp, isTeacher: $isTeacher, sessionId: $sessionId, roomId: $roomId) {
      roomId,
      userId,
      sessionId,
      isTeacher,
      joinTimestamp,
      leaveTimestamp,
    }
}`;

export const SEND_ATTENDANCE_MUTAION = gql`
  mutation sendAttendance($roomId: String!) {
    sendAttendance(roomId: $roomId)
  }
`;

export const SCHEDULE_ATTENDANCE_MUTATION = gql`
  mutation scheduleAttendance($roomId: String!) {
    scheduleAttendance(roomId: $roomId)
  }
`;

export const SAVE_FEEDBACK_MUTATION = gql`
mutation SaveFeedbackMutation($roomId: String!, $userId: String!, $sessionId: String!, $stars: Int!, $feedbackType: String!, $comment: String!, $quickFeedback: [QuickFeedbackInputType!]!) {
  saveFeedback(roomId: $roomId, userId: $userId, sessionId: $sessionId, stars: $stars, feedbackType: $feedbackType, comment: $comment, quickFeedback: $quickFeedback) {
    sessionId
    createdAt
    roomId
    userId
    type
    stars
    comment
  }
}
`;
