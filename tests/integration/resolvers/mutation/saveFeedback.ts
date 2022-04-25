import { MUTATION_SAVE_FEEDBACK } from "../../graphql/mutation";
import { feedbackMockData } from "../../mockData/resolverMock";
import { CustomApolloClient } from "../../apolloClient";
import { ClassType } from "../../../../src/types";
import { getToken } from "../../mockData/generateToken";

export const feedback = () => {
    const teacher_Live_Token = getToken (ClassType.LIVE, true, false, false);
    const student_Live_Token = getToken (ClassType.LIVE, false, false, false);
    const clientTeacher = new CustomApolloClient(teacher_Live_Token);
    const clientStudent = new CustomApolloClient(student_Live_Token);
    it("save Feedback as Teacher", async () => {
        const result = await clientTeacher.createMutation({query: MUTATION_SAVE_FEEDBACK, variables: feedbackMockData});
        expect(result.data.saveFeedback).toBe(true);
    });

    //Student
    it("save Feedback as Student", async () => {
        const result = await clientStudent.createMutation({query: MUTATION_SAVE_FEEDBACK, variables: feedbackMockData});
        expect(result.data.saveFeedback).toBe(true);
    });
};
