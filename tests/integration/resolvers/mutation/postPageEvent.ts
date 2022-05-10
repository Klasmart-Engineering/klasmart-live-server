import { MUTATION_POST_PAGE_EVENTS } from "../../graphql/mutation";
import { CustomApolloClient } from "../../apolloClient";
import { ClassType } from "../../../../src/types";
import { getToken } from "../../mockData/generateToken";
import { pageEventMockData } from "../../mockData/resolverMock";
import { getUniqueId } from "../../mockData/functions";

export const postPageEvent = () => {
    const teacher_Live_Token = getToken (ClassType.LIVE, true, false, false);
    const student_Live_Token = getToken (ClassType.LIVE, false, false, false);
    const clientTeacher = new CustomApolloClient(teacher_Live_Token);
    const clientStudent = new CustomApolloClient(student_Live_Token);
    const streamId = getUniqueId();

    it("postPageEvent as Teacher", async () => {
        const result = await clientTeacher.createMutation({query: MUTATION_POST_PAGE_EVENTS, variables: {streamId, pageEvents: pageEventMockData}});
        expect(result.data.postPageEvent).toBe(true);
    });

    it("postPageEvent as Student", async () => {
        const result = await clientStudent.createMutation({query: MUTATION_POST_PAGE_EVENTS, variables: {streamId, pageEvents: pageEventMockData}});
        expect(result.data.postPageEvent).toBe(true);
        clientTeacher.stop();
        clientStudent.stop();
    });
};
