import { MUTATION_SET_SESSION_STREAMID } from "../../graphql/mutation";
import { QUERY_TOKEN } from "../../graphql/query";
import { CustomApolloClient } from "../../apolloClient";
import { getUniqueId } from "../../mockData/functions";
import { ClassType } from "../../../../src/types";
import { getToken } from "../../mockData/generateToken";

export const setSessionStreamId = () => {
    const teacher_Live_Token = getToken (ClassType.LIVE, true, false, false);
    const student_Live_Token = getToken (ClassType.LIVE, false, false, false);
    const clientTeacher = new CustomApolloClient(teacher_Live_Token);
    const clientStudent = new CustomApolloClient(student_Live_Token);
    //Teacher
    it("setSessionSteramId as Teacher with streamId", async () => {
        const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
        const roomId = query.data.token.roomId;
        const streamId = getUniqueId();
        const result = await clientTeacher.createMutation({query: MUTATION_SET_SESSION_STREAMID, variables: {roomId,streamId}});
        expect(result.data.setSessionStreamId).toBe(true);
    });

    it("setSessionSteramId as Teacher without streamId", async () => {
        const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
        const roomId = query.data.token.roomId;
        const result = await clientTeacher.createMutation({query: MUTATION_SET_SESSION_STREAMID, variables: {roomId }});
        expect(result.data).toBe(undefined);
    });

    //Student
    it("setSessionSteramId as Student with streamId", async () => {
        const query = await clientStudent.createQuery({query: QUERY_TOKEN});
        const roomId = query.data.token.roomId;
        const streamId = getUniqueId();
        const result = await clientStudent.createMutation({query: MUTATION_SET_SESSION_STREAMID, variables: {roomId, streamId}});
        expect(result.data.setSessionStreamId).toBe(true);
    });
    it("setSessionSteramId as Student without streamId", async () => {
        const query = await clientStudent.createQuery({query: QUERY_TOKEN});
        const roomId = query.data.token.roomId;
        const result = await clientStudent.createMutation({query: MUTATION_SET_SESSION_STREAMID, variables: {roomId}});
        expect(result.data).toBe(undefined);
    });
};
