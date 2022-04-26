
import {  SUBSCRIPTION_WHITEBOARD_PERMISSIONS,
          // SUBSCRIPTION_WHITEBOARD_EVENTS,
          // SUBSCRIPTION_WHITEBOARD_STATE,
          // 
        } from "../../graphql/subscription";
import { MUTATION_WHITEBOARD_SEND_PERMISSIONS,  } from "../../graphql/mutation";
import { QUERY_TOKEN } from "../../graphql/query";
import { CustomApolloClient } from "../../apolloClient";
import { ClassType } from "../../../../src/types";
import { WhiteboardPermissions } from "../../mockData/types";
import { getToken } from "../../mockData/generateToken";
import { getUniqueId } from "../../mockData/functions";
import { whiteboardSendPermissionsMockData } from "../../mockData/resolverMock";


export const whiteboard = () => {
  const roomid = getUniqueId();
  const teacher_Live_Token = getToken (ClassType.LIVE, true, false, false, roomid);
  const student_Live_Token = getToken (ClassType.LIVE, false, false, false, roomid);
  const clientTeacher = new CustomApolloClient(teacher_Live_Token);
  const clientStudent = new CustomApolloClient(student_Live_Token);
  
  it('SUBSCRIPTION test whiteboard.permissions', async () => {
    /**
     * 1. Teacher subscribe for all Whiteboard events
     * 2. Student subscribe for all Whiteboard events
     * 3. Teacher post event
     * 4. Check if Student receives event which posted by teacher
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
    expect(expected).toMatchObject(whiteboardSendPermissionsMockData);
    
    studentSub.disconnect()
    clientTeacher.stop();
    clientStudent.stop();
  })
}