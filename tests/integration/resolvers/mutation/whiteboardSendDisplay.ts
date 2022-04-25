import { MUTATION_WHITEBOARD_SEND_DISPLAY } from "../../graphql/mutation";
import { QUERY_TOKEN } from "../../graphql/query";
import { CustomApolloClient } from "../../apolloClient";
import { ClassType } from "../../../../src/types";
import { getToken } from "../../mockData/generateToken";
import { getRandomBoolean } from "../../mockData/functions";

export const whiteboardSendDisplay = () => {
    const teacher_Live_Token = getToken (ClassType.LIVE, true, false, false);
    const student_Live_Token = getToken (ClassType.LIVE, false, false, false);
    const clientTeacher = new CustomApolloClient(teacher_Live_Token);
    const clientStudent = new CustomApolloClient(student_Live_Token);

    it("whiteboardSendDisplay as Teacher", async () => {
        const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
        const roomId = query.data.token.roomId;
        const result = await clientStudent.createMutation({
          query: MUTATION_WHITEBOARD_SEND_DISPLAY, variables: {
            roomId, 
            display: getRandomBoolean()
          }});
        expect(result.data.whiteboardSendDisplay).toBe(true);
    });

};
