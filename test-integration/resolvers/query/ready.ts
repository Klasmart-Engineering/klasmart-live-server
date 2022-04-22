import { QUERY_READY } from "../../graphql/query";
import { CustomApolloClient } from "../../apolloClient";
import { ClassType } from "../../../src/types";
import { getToken } from "../../mockData/generateToken";
export const ready = () => {
    const teacher_Live_Token = getToken (ClassType.LIVE, true, false, false);
    const student_Live_Token = getToken (ClassType.LIVE, false, false, false);
    const clientTeacher = new CustomApolloClient(teacher_Live_Token);
    const clientStudent = new CustomApolloClient(student_Live_Token);
    //Teacher
    it("check if Server is ready as Teacher", async () => {
        const query = await clientTeacher.createQuery({query: QUERY_READY});
        expect(query.data.ready).toBe(true);
    });

    //Student
    it("check if Server is ready as Student", async () => {
        const query = await clientStudent.createQuery({query: QUERY_READY});
        expect(query.data.ready).toBe(true);
    });
};
