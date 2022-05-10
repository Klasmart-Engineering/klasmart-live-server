
import { SUBSCRIPTION_STREAM } from "../../graphql/subscription";
import { MUTATION_SET_SESSION_STREAMID, MUTATION_POST_PAGE_EVENTS } from "../../graphql/mutation";
import { QUERY_TOKEN } from "../../graphql/query";
import { CustomApolloClient } from "../../apolloClient";
import { ClassType } from "../../../../src/types";
import { getToken } from "../../mockData/generateToken";
import { getUniqueId } from "../../mockData/functions";
import { pageEventMockData } from "../../mockData/resolverMock";

export const stream = () => {
  const roomid = getUniqueId();
  const teacher_Live_Token = getToken (ClassType.LIVE, true, false, false, roomid);
  const student_Live_Token = getToken (ClassType.LIVE, false, false, false, roomid);
  const clientTeacher = new CustomApolloClient(teacher_Live_Token);
  const clientStudent = new CustomApolloClient(student_Live_Token);
  
  it('SUBSCRIPTION test stream', async () => {
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
    await studentSub.wait(1000);

    // 3
    await clientTeacher.createMutation({query: MUTATION_POST_PAGE_EVENTS, variables: {streamId, pageEvents: pageEventMockData}});
    await studentSub.wait(1000);
    // 4
    expect(studentSub.results[0].data.stream.event).toEqual(pageEventMockData.eventData);

    // unsubscribe clients
    studentSub.disconnect();

    clientTeacher.stop();
    clientStudent.stop();
  })
}