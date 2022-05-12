import { MUTATION_SHOW_CONTENT } from "../../graphql/mutation";
import { QUERY_TOKEN } from "../../graphql/query";
import { CustomApolloClient } from "../../apolloClient";
import { ClassType } from "../../../../src/types";
import { getToken } from "../../mockData/generateToken";
import { contentTypeMockData } from "../../mockData/resolverMock";

export const showContent = () => {
    const teacher_Live_Token = getToken (ClassType.LIVE, true, false, false);
    const student_Live_Token = getToken (ClassType.LIVE, false, false, false);
    const clientTeacher = new CustomApolloClient(teacher_Live_Token);
    const clientStudent = new CustomApolloClient(student_Live_Token);

    it("showContent as Teacher", async () => {
        const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
        const roomId = query.data.token.roomId;
        const result = await clientStudent.createMutation({
            query: MUTATION_SHOW_CONTENT, variables: {
                roomId, 
                type: contentTypeMockData.type, 
                contnetId: contentTypeMockData.contentId
            }});
        expect(result.data.showContent).toBe(true);
    });

    it("showContent with wrong content type as Teacher", async () => {
        const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
        const roomId = query.data.token.roomId;
        const result = await clientStudent.createMutation({
            query: MUTATION_SHOW_CONTENT, variables: {
                roomId, 
                type: "no Content", 
                contnetId: contentTypeMockData.contentId
            }});
        expect(result.data).toBe(undefined);
    });


    it("showContent as Student", async () => {
        const query = await clientStudent.createQuery({query: QUERY_TOKEN});
        const roomId = query.data.token.roomId;
        const result = await clientStudent.createMutation({
            query: MUTATION_SHOW_CONTENT, variables: {
                roomId, 
                type: contentTypeMockData.type, 
                contnetId: contentTypeMockData.contentId
            }});
        expect(result.data.showContent).toBe(true);
        clientTeacher.stop();
        clientStudent.stop();
    });
};
