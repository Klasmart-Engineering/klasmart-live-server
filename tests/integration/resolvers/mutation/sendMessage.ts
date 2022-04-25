import { MUTATION_SEND_MESSAGE } from "../../graphql/mutation";
import { QUERY_TOKEN } from "../../graphql/query";
import { CustomApolloClient } from "../../apolloClient";
import { ClassType } from "../../../../src/types";
import { getToken } from "../../mockData/generateToken";

export const sendMessage = () => {
    const teacher_Live_Token = getToken (ClassType.LIVE, true, false, false);
    const student_Live_Token = getToken (ClassType.LIVE, false, false, false);
    const clientTeacher = new CustomApolloClient(teacher_Live_Token);
    const clientStudent = new CustomApolloClient(student_Live_Token);

    it("sendMessage as Teacher", async () => {
        const message = "message from Teacher";
        const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
        const roomId = query.data.token.roomId;
        const result = await clientTeacher.createMutation({query: MUTATION_SEND_MESSAGE, variables: {roomId, message}});
        expect(result.data.sendMessage.message).toMatch(message);
    });

    it("send empty message", async () => {
        const message = "";
        const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
        const roomId = query.data.token.roomId;
        const result = await clientTeacher.createMutation({query: MUTATION_SEND_MESSAGE, variables: {roomId, message}});
        expect(result.data.sendMessage).toBe(null);
    });


    it("sendMessage as Student", async () => {
        const message = "message from Student";
        const query = await clientStudent.createQuery({query: QUERY_TOKEN});
        const roomId = query.data.token.roomId;
        const result = await clientStudent.createMutation({query: MUTATION_SEND_MESSAGE, variables: {roomId, message}});
        expect(result.data.sendMessage.message).toMatch(message);
    });
};
