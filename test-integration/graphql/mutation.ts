import {
    gql
} from "@apollo/client";

export const MUTATION_SAVE_FEEDBACK = gql`
    mutation saveFeedback($stars: Int!, $feedbackType: FeedbackType!, $comment: String, $quickFeedback: [QuickFeedbackInput]) {
        saveFeedback(stars: $stars, feedbackType: $feedbackType, comment: $comment, quickFeedback: $quickFeedback)
    }`;

export const MUTATION_ENDCLASS = gql`
    mutation endClass {
        endClass
    }`;

export const MUTATION_LEAVECLASS = gql`
    mutation leaveClass {
        leaveClass
    }
`; 

export const MUTATION_SET_SESSION_STREAMID = gql`
    mutation setSessionStreamId($roomId: ID!, $streamId: ID!) {
        setSessionStreamId(roomId: $roomId, streamId: $streamId)
    }
`;

export const MUTATION_SET_HOST = gql`
    mutation setHost($roomId: ID!, $nextHostId: ID!) {
        setHost(roomId: $roomId, nextHostId: $nextHostId)
    }
`;

export const MUTATION_SEND_MESSAGE = gql`
    mutation sendMessage($roomId: ID!, $message: String) {
        sendMessage(roomId: $roomId, message: $message) {
            id,
            message
        }
    }
`;

export const MUTATION_POST_PAGE_EVENTS = gql`
    mutation postPageEvent($streamId: ID!, $pageEvents: [PageEventIn]) {
        postPageEvent(streamId: $streamId, pageEvents: $pageEvents)
    }
`;

export const MUTATION_SHOW_CONTENT = gql`
    mutation showContent($roomId: ID!, $type: ContentType!, $contentId: ID) {
        showContent(roomId: $roomId, type: $type, contentId: $contentId)
    }
`;

export const MUTATION_WHITEBOARD_SEND_EVENT = gql`
    mutation whiteboardSendEvent($roomId: ID!, $event: String) {
    whiteboardSendEvent(roomId: $roomId, event: $event)
    }
`;

export const MUTATION_WHITEBOARD_SEND_DISPLAY = gql`
    mutation whiteboardSendDisplay($roomId: ID!, $display: Boolean) {
        whiteboardSendDisplay(roomId: $roomId, display: $display)
    }
`;

export const MUTATION_WHITEBOARD_SEND_PERMISSIONS = gql`
    mutation whiteboardSendPermissions($roomId: ID!, $userId: ID!, $permissions: String) {
        whiteboardSendPermissions(roomId: $roomId, userId: $userId, permissions: $permissions)
    }
`;

export const MUTATION_MUTE = gql`
    mutation mute($roomId: ID!, $sessionId: ID!, $audio: Boolean, $video: Boolean) {
        mute(roomId: $roomId, sessionId: $sessionId, audio: $audio, video: $video)
    }
`;

export const MUTATION_REWARD_TROPHY = gql`
    mutation rewardTrophy($roomId: ID!, $user: ID!, $kind: String) {
        rewardTrophy(roomId: $roomId, user: $user, kind: $kind)
    }
`;

export const MUTATION_SEND_STUDENT_USAGE_RECORD_EVENT = gql`
    mutation sendStudentUsageRecordEvent($roomId: ID!, $materialUrl: String, $activityTypeName: String){
        studentReport(roomId: $roomId, materialUrl: $materialUrl, activityTypeName: $activityTypeName)
    }
`;

export const MUTATION_SET_CLASS_ATTENDEES = gql`
    mutation setClassAttendees($roomId: ID!, $userIds: [String]) {
        setClassAttendees(roomId: $roomId, userIds: $userIds)
    }
`;