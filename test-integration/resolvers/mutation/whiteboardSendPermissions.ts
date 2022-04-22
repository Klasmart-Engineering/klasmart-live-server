import { MUTATION_WHITEBOARD_SEND_PERMISSIONS } from "../../graphql/mutation";
import { QUERY_TOKEN } from "../../graphql/query";
import { CustomApolloClient } from "../../apolloClient";
import { ClassType } from "../../../src/types";
import { getToken } from "../../mockData/generateToken";
import { getRandomString } from "../../mockData/functions";
import { whiteboardSendPermissionsMockData } from "../../mockData/resolverMock";

export const whiteboardSendPermissions = () => {
    const teacher_Live_Token = getToken (ClassType.LIVE, true, false, false);
    const student_Live_Token = getToken (ClassType.LIVE, false, false, false);
    const clientTeacher = new CustomApolloClient(teacher_Live_Token);
    const clientStudent = new CustomApolloClient(student_Live_Token);

    it("whiteboardSendPermissions as Teacher", async () => {
      const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
      const queryStudent = await clientStudent.createQuery({query: QUERY_TOKEN})
      const roomId = query.data.token.roomId;
      const userId= queryStudent.data.token.userId;

      const result = await clientStudent.createMutation({
        query: MUTATION_WHITEBOARD_SEND_PERMISSIONS, variables: {
          roomId, 
          userId,
          permissions: whiteboardSendPermissionsMockData
        }});
      expect(result.data.whiteboardSendPermissions).toBe(true);
    });
    
    // this test should not pass with random stirng, 
    // but in whiteboardSendPermissions permissions are exepted as sting and 
    // there is no type check
    it("whiteboardSendPermissions with wrong permissions as Teacher", async () => {
        const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
        const queryStudent = await clientStudent.createQuery({query: QUERY_TOKEN})
        const roomId = query.data.token.roomId;
        const userId= queryStudent.data.token.userId;

        const result = await clientStudent.createMutation({
          query: MUTATION_WHITEBOARD_SEND_PERMISSIONS, variables: {
            roomId, 
            userId,
            permissions: getRandomString()
          }});
        expect(result.data.whiteboardSendPermissions).toBe(true);
    });

};
