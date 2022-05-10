import { MUTATION_LEAVECLASS } from "../../graphql/mutation";
import { QUERY_TOKEN } from "../../graphql/query";
import { CustomApolloClient } from "../../apolloClient";
import { ClassType } from "../../../../src/types";
import { getToken } from "../../mockData/generateToken";

export const leaveClass = () => {
    const teacher_Live_Token = getToken (ClassType.LIVE, true, false, false);
    const student_Live_Token = getToken (ClassType.LIVE, false, false, false);
    const clientTeacher = new CustomApolloClient(teacher_Live_Token);
    const clientStudent = new CustomApolloClient(student_Live_Token);
    it("LeaveClass as Teacher", async () => {
        const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
        const roomId = query.data.token.roomId;
        const result = await clientTeacher.createMutation({query: MUTATION_LEAVECLASS, variables: {roomId}});
        expect(result.data.leaveClass).toBe(true);
    });

    it("LeaveClass as Student", async () => {
        const query = await clientStudent.createQuery({query: QUERY_TOKEN});
        const roomId = query.data.token.roomId;
        const result = await clientStudent.createMutation({query: MUTATION_LEAVECLASS, variables: {roomId}});
        expect(result.data.leaveClass).toBe(true);
        clientTeacher.stop();
        clientStudent.stop();
    });
};
