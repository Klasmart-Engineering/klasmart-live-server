import { MUTATION_SET_HOST } from "../../graphql/mutation";
import { QUERY_TOKEN } from "../../graphql/query";
import { CustomApolloClient } from "../../apolloClient";
import { ClassType } from "../../../src/types";
import { getToken } from "../../mockData/generateToken";
import { getUniqueId } from "../../mockData/functions";

export const setHost = () => {
    const teacher_Live_Token = getToken (ClassType.LIVE, true, false, false);
    const student_Live_Token = getToken (ClassType.LIVE, false, false, false);
    const clientTeacher = new CustomApolloClient(teacher_Live_Token);
    const clientStudent = new CustomApolloClient(student_Live_Token);
    it("setHost as Teacher", async () => {
        const nextHostId = getUniqueId();
        const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
        const roomId = query.data.token.roomId;
        const result = await clientTeacher.createMutation({query: MUTATION_SET_HOST, variables: {roomId, nextHostId}});
        expect(result.data.setHost).toBe(true);
    });

    it("setHost without hostId as Teacher", async () => {
        const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
        const roomId = query.data.token.roomId;
        const result = await clientTeacher.createMutation({query: MUTATION_SET_HOST, variables: {roomId}});
        expect(result.data).toBe(undefined);
    });

    it("setHost as Student", async () => {
        const nextHostId = getUniqueId();
        const query = await clientStudent.createQuery({query: QUERY_TOKEN});
        const roomId = query.data.token.roomId;
        const result = await clientStudent.createMutation({query: MUTATION_SET_HOST, variables: {roomId, nextHostId}});
        expect(result.data.setHost).toBe(null);
    });
};
