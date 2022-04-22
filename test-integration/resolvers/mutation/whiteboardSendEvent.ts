import { MUTATION_WHITEBOARD_SEND_EVENT } from "../../graphql/mutation";
import { QUERY_TOKEN } from "../../graphql/query";
import { CustomApolloClient } from "../../apolloClient";
import { ClassType } from "../../../src/types";
import { getToken } from "../../mockData/generateToken";
import { whiteboardSendEventMockData } from "../../mockData/resolverMock";

export const whiteboardSendEvent = () => {
    const teacher_Live_Token = getToken (ClassType.LIVE, true, false, false);
    const student_Live_Token = getToken (ClassType.LIVE, false, false, false);
    const clientTeacher = new CustomApolloClient(teacher_Live_Token);
    const clientStudent = new CustomApolloClient(student_Live_Token);

    it("whiteboardSendEvent as Teacher", async () => {
        const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
        const roomId = query.data.token.roomId;
        const result = await clientStudent.createMutation({
          query: MUTATION_WHITEBOARD_SEND_EVENT, variables: {
            roomId, 
            event: JSON.stringify(whiteboardSendEventMockData)
          }});
        expect(result.data.whiteboardSendEvent).toBe(true);
    });

    it("whiteboardSendEvent with wrong data as Teacher", async () => {
      const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
      const roomId = query.data.token.roomId;
      const result = await clientStudent.createMutation({
        query: MUTATION_WHITEBOARD_SEND_EVENT, variables: {
          roomId, 
          event: ''
        }});
      expect(result.data.whiteboardSendEvent).toBe(null);
  });


    it("whiteboardSendEvent as Student", async () => {
        const query = await clientStudent.createQuery({query: QUERY_TOKEN});
        const roomId = query.data.token.roomId;
        const result = await clientStudent.createMutation({
          query: MUTATION_WHITEBOARD_SEND_EVENT, variables: {
            roomId, 
            event: JSON.stringify(whiteboardSendEventMockData)
          }});
        expect(result.data.whiteboardSendEvent).toBe(true);
    });
};
