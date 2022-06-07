import { SUBSCRIPTION_ROOM } from "../graphql/subscription";
import { MUTATION_LEAVECLASS, MUTATION_SEND_MESSAGE,MUTATION_REWARD_TROPHY } from "../graphql/mutation";
import { SUBSCRIPTION_STREAM } from "../graphql/subscription";
import { MUTATION_SET_SESSION_STREAMID, MUTATION_POST_PAGE_EVENTS } from "../graphql/mutation";
import {  SUBSCRIPTION_WHITEBOARD_PERMISSIONS,
    SUBSCRIPTION_WHITEBOARD_EVENTS,
    SUBSCRIPTION_WHITEBOARD_STATE,
} from "../graphql/subscription";
import { MUTATION_WHITEBOARD_SEND_PERMISSIONS,
    MUTATION_WHITEBOARD_SEND_DISPLAY,
    MUTATION_WHITEBOARD_SEND_EVENT
} from "../graphql/mutation";

import { QUERY_TOKEN } from "../graphql/query";
import { CustomApolloClient } from "../apolloClient";
import { ClassType } from "../../../src/types";
import { WhiteboardPermissions } from "../mockData/types";

import { ContentType } from "../mockData/types";
import { getToken } from "../mockData/generateToken";
import { getUniqueId, getRandomBoolean } from "../mockData/functions";
import { rewardThropyMockData } from "../mockData/resolverMock";
import { pageEventMockData } from "../mockData/resolverMock";
import { whiteboardSendPermissionsMockData } from "../mockData/resolverMock";
import { whiteboardSendEventMockData } from "../mockData/resolverMock";
import { PainterEvent } from "../../../src/services/whiteboard/events/PainterEvent";

export const subscriptions = () => {

    const roomid = getUniqueId();
    const teacher_Live_Token = getToken (ClassType.LIVE, true, false, false, roomid);
    const student_Live_Token = getToken (ClassType.LIVE, false, false, false, roomid);
    const clientTeacher = new CustomApolloClient(teacher_Live_Token);
    const clientStudent = new CustomApolloClient(student_Live_Token);

    afterAll(() => {
        clientTeacher.stop();
        clientStudent.stop();
    });

    describe("room", () => {
        it("room.join", async () => {
            /**
       * 1. Teacher subscribe
       * 2. Student subscribe
       * 3. Check if teacher get notification about Student join
       * 4. Check if teacher and student get notification about content
       *    content is the first notificaiton users get after join room
      */
  
            const queryTeacher = await clientTeacher.createQuery({query: QUERY_TOKEN});
            const roomId = queryTeacher.data.token.roomId;
            const queryStudent = await clientStudent.createQuery({query: QUERY_TOKEN});

            // 1
            const teacherSub = await clientTeacher.createSubscription({
                query: SUBSCRIPTION_ROOM, 
                variables: {roomId}
            });

            await teacherSub.wait(2000);

            // 2
            const studentSub = await clientStudent.createSubscription({
                query: SUBSCRIPTION_ROOM, 
                variables: {roomId}
            });

            await teacherSub.wait(2000);

            // 3
            expect(studentSub.results[0].data.room.content.type).toEqual(ContentType.Blank);
            expect(teacherSub.results[0].data.room.content.type).toEqual(ContentType.Blank);
  
            // 4
            expect(teacherSub.results[2].data.room.join.name).toEqual(queryStudent.data.token.userName);

            // unsubscribe clients
            teacherSub.disconnect();
            studentSub.disconnect();
    
        });

        it("room.leave", async () => {
            /**
       * 1. Teacher subscribe
       * 2. Student subscribe
       * 3. Student leave class 
       * 4. Check if Teacher get message about user who left the class from server
      */

            const queryTeacher = await clientTeacher.createQuery({query: QUERY_TOKEN});
            const roomId = queryTeacher.data.token.roomId;

            // 1
            const teacherSub = await clientTeacher.createSubscription({
                query: SUBSCRIPTION_ROOM, 
                variables: {roomId}
            });
            await teacherSub.wait(2000);

            // 2
            const studentSub = await clientStudent.createSubscription({
                query: SUBSCRIPTION_ROOM, 
                variables: {roomId}
            });

            await studentSub.wait(2000);
            // 3
            await clientStudent.createMutation({query: MUTATION_LEAVECLASS, variables: {roomId}});
            await teacherSub.wait(2000);
            // 4
            expect(teacherSub.results[3].data.room.leave.id).toEqual(studentSub.results[2].data.room.join.id);
    
            // unsubscribe clients
            studentSub.disconnect();
            teacherSub.disconnect();
        });

        it("room.message", async () => {
            /**
       * 1. Teacher subscribe
       * 2. Student subscribe
       * 3. Teacher send message in chat
       * 4. Check if Student receives message
      */

            const queryTeacher = await clientTeacher.createQuery({query: QUERY_TOKEN});
            const roomId = queryTeacher.data.token.roomId;

            // 1
            const teacherSub = await clientTeacher.createSubscription({
                query: SUBSCRIPTION_ROOM, 
                variables: {roomId}
            });
            await teacherSub.wait(2000);

            // 2
            const studentSub = await clientStudent.createSubscription({
                query: SUBSCRIPTION_ROOM, 
                variables: {roomId}
            });
            await studentSub.wait(2000);

            // 3
            const message = "message from Teacher";
            await clientTeacher.createMutation({query: MUTATION_SEND_MESSAGE, variables: {roomId, message}});

            await teacherSub.wait(2000);
            // 4
            expect(studentSub.results[3].data.room.message.message).toEqual(message);

            // unsubscribe clients
            studentSub.disconnect();
            teacherSub.disconnect();
        });

        it("room.trophy", async () => {
            /**
       * 1. Teacher subscribe
       * 2. Student subscribe
       * 3. Teacher send Trophy
       * 4. Check if Student receives trophy
      */

            const queryTeacher = await clientTeacher.createQuery({query: QUERY_TOKEN});
            const roomId = queryTeacher.data.token.roomId;
            const queryStudent = await clientStudent.createQuery({query: QUERY_TOKEN});
            const studentId = queryStudent.data.token.userId;
            // 1
            const teacherSub = await clientTeacher.createSubscription({
                query: SUBSCRIPTION_ROOM, 
                variables: {roomId}
            });
            await teacherSub.wait(2000);

            // 2
            const studentSub = await clientStudent.createSubscription({
                query: SUBSCRIPTION_ROOM, 
                variables: {roomId}
            });
            await studentSub.wait(2000);

            // 3
            const kind = rewardThropyMockData.kind;
            await clientTeacher.createMutation({
                query: MUTATION_REWARD_TROPHY, variables: {
                    roomId, 
                    user: studentId,
                    kind
                }});

            await studentSub.wait(2000);
            // 4
            expect(studentSub.results[4].data.room.trophy.from).toEqual(teacherSub.results[1].data.room.join.id);
            expect(studentSub.results[4].data.room.trophy.kind).toEqual(kind);

            // unsubscribe clients
            studentSub.disconnect();
            teacherSub.disconnect();

            clientTeacher.stop();
            clientStudent.stop();
        });
    });
  
    describe("stream", () => {
        it("SUBSCRIPTION test stream", async () => {
            /**
       * 1. Teacher set session streamId
       * 2. Student subscribe to stream
       * 3. Teacher post event
       * 4. Check if Student receives event which posted by teacher
      */
  
            const queryTeacher = await clientTeacher.createQuery({query: QUERY_TOKEN});
            const roomId = queryTeacher.data.token.roomId;

            const streamId = getUniqueId();
            // 1
            await clientTeacher.createMutation({query: MUTATION_SET_SESSION_STREAMID, variables: {roomId,streamId}});

            // 2
            const studentSub = await clientStudent.createSubscription({
                query: SUBSCRIPTION_STREAM, 
                variables: {streamId}
            });
            await studentSub.wait(2000);

            // 3
            await clientTeacher.createMutation({query: MUTATION_POST_PAGE_EVENTS, variables: {streamId, pageEvents: pageEventMockData}});
            await studentSub.wait(2000);
            // 4
            expect(studentSub.results[0].data.stream.event).toEqual(pageEventMockData.eventData);

            // unsubscribe clients
            studentSub.disconnect();

            clientTeacher.stop();
            clientStudent.stop();
        });
    });
  
    describe("whiteboard", () => {
        it("SUBSCRIPTION test whiteboard.permissions", async () => {
            /**
       * 1. Student subscribes to Whiteboard.permissions channel
       * 2. Teachers send permission to student
       * 3. Check if student received permission 
      */

            const queryTeacher = await clientTeacher.createQuery({query: QUERY_TOKEN});
            const roomId = queryTeacher.data.token.roomId;
            const queryStudent = await clientStudent.createQuery({query: QUERY_TOKEN});
            const userId = queryStudent.data.token.userId;
            // 1
            const studentSub = await clientStudent.createSubscription({
                query: SUBSCRIPTION_WHITEBOARD_PERMISSIONS, 
                variables: {roomId, userId}
            });
            await studentSub.wait(2000);

            // 2
            await clientTeacher.createMutation({
                query: MUTATION_WHITEBOARD_SEND_PERMISSIONS, variables: {
                    roomId, 
                    userId,
                    permissions: JSON.stringify(whiteboardSendPermissionsMockData)
                }});

            await studentSub.wait(2000);
            const result = studentSub.results[0].data.whiteboardPermissions;
            const expected = JSON.parse(result) as WhiteboardPermissions;
            // 3
            expect(expected).toMatchObject(whiteboardSendPermissionsMockData);
  
            studentSub.disconnect();
        });
  
        it("SUBSCRIPTION test whiteboard.state", async () => {
            /**
       * 1. Student subscribes to Whiteboard.state channel
       * 2. Teacher sends state of the display to student
       * 3. Check if student received display state 
      */

            const queryTeacher = await clientTeacher.createQuery({query: QUERY_TOKEN});
            const roomId = queryTeacher.data.token.roomId;
            // 1
            const studentSub = await clientStudent.createSubscription({
                query: SUBSCRIPTION_WHITEBOARD_STATE, 
                variables: {roomId}
            });
            await studentSub.wait(2000);

            // 2
            const bool = getRandomBoolean();
            await clientTeacher.createMutation({
                query: MUTATION_WHITEBOARD_SEND_DISPLAY, variables: {
                    roomId, 
                    display: bool
                }});

            await studentSub.wait(2000);
            // 3
            expect(studentSub.results[1].data.whiteboardState.display).toEqual(bool);
    
            studentSub.disconnect();
        });

        it("SUBSCRIPTION test whiteboard.event", async () => {
            /**
       * 1. Student subscribe to Whiteboard.event channel
       * 2. Teacher sends events to student
       * 3. Check if student received events
      */
  
            const queryTeacher = await clientTeacher.createQuery({query: QUERY_TOKEN});
            const roomId = queryTeacher.data.token.roomId;
            // 1
            const studentSub = await clientStudent.createSubscription({
                query: SUBSCRIPTION_WHITEBOARD_EVENTS, 
                variables: {roomId}
            });
            await studentSub.wait(2000);

            // 2
            await clientTeacher.createMutation({
                query: MUTATION_WHITEBOARD_SEND_EVENT, variables: {
                    roomId, 
                    event: JSON.stringify(whiteboardSendEventMockData)
                }});

            await studentSub.wait(2000);
            // 3
            const expected = studentSub.results[0].data.whiteboardEvents[0] as PainterEvent;
            expect(expected).toMatchObject(whiteboardSendEventMockData);
  
            studentSub.disconnect();
            clientTeacher.stop();
            clientStudent.stop();
        });
    });
  
};