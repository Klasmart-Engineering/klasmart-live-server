
import {  SUBSCRIPTION_WHITEBOARD_PERMISSIONS,
          SUBSCRIPTION_WHITEBOARD_EVENTS,
          SUBSCRIPTION_WHITEBOARD_STATE,
          // 
        } from "../../graphql/subscription";
import { MUTATION_WHITEBOARD_SEND_PERMISSIONS,
         MUTATION_WHITEBOARD_SEND_DISPLAY,
         MUTATION_WHITEBOARD_SEND_EVENT
      } from "../../graphql/mutation";
import { QUERY_TOKEN } from "../../graphql/query";
import { CustomApolloClient } from "../../apolloClient";
import { ClassType } from "../../../../src/types";
import { WhiteboardPermissions } from "../../mockData/types";
import { getToken } from "../../mockData/generateToken";
import { getRandomBoolean, getUniqueId } from "../../mockData/functions";
import { whiteboardSendPermissionsMockData } from "../../mockData/resolverMock";
import { whiteboardSendEventMockData } from "../../mockData/resolverMock";
import { PainterEvent } from "../../../../src/services/whiteboard/events/PainterEvent";


export const whiteboard = () => {
  const roomid = getUniqueId();
  const teacher_Live_Token = getToken (ClassType.LIVE, true, false, false, roomid);
  const student_Live_Token = getToken (ClassType.LIVE, false, false, false, roomid);
  const clientTeacher = new CustomApolloClient(teacher_Live_Token);
  const clientStudent = new CustomApolloClient(student_Live_Token);
  
  it('SUBSCRIPTION test whiteboard.permissions', async () => {
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
    await studentSub.wait(1000);

    // 2
    await clientTeacher.createMutation({
      query: MUTATION_WHITEBOARD_SEND_PERMISSIONS, variables: {
        roomId, 
        userId,
        permissions: JSON.stringify(whiteboardSendPermissionsMockData)
    }});

    await studentSub.wait(1000);
    const result = studentSub.results[0].data.whiteboardPermissions;
    const expected = JSON.parse(result) as WhiteboardPermissions;
    // 3
    expect(expected).toMatchObject(whiteboardSendPermissionsMockData);
    
    studentSub.disconnect();
  })

  it('SUBSCRIPTION test whiteboard.state', async () => {
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
    await studentSub.wait(1000);

    // 2
    const bool = getRandomBoolean()
    await clientTeacher.createMutation({
      query: MUTATION_WHITEBOARD_SEND_DISPLAY, variables: {
        roomId, 
        display: bool
    }});

    await studentSub.wait(1000);
    // 3
    expect(studentSub.results[0].data.whiteboardState.display).toEqual(bool);
    
    studentSub.disconnect()
  });

  it('SUBSCRIPTION test whiteboard.event', async () => {
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
    await studentSub.wait(1000);

    // 2
    await clientTeacher.createMutation({
      query: MUTATION_WHITEBOARD_SEND_EVENT, variables: {
        roomId, 
        event: JSON.stringify(whiteboardSendEventMockData)
    }});

    await studentSub.wait(1000);
    // 3
    const expected = studentSub.results[0].data.whiteboardEvents[0] as PainterEvent;
    expect(expected).toMatchObject(whiteboardSendEventMockData);
    
    studentSub.disconnect()
    clientTeacher.stop();
    clientStudent.stop();
  })
}