import { QUERY_TOKEN } from "../../graphql/query";
import { CustomApolloClient } from "../../apolloClient";
import { ClassType } from "../../../src/types";
import { getToken } from "../../mockData/generateToken";

export const token = () => {
    const teacher_Live_Token = getToken (ClassType.LIVE, true, false, false);
    const student_Live_Token = getToken (ClassType.LIVE, false, false, false);
    const clientTeacher = new CustomApolloClient(teacher_Live_Token);
    const clientStudent = new CustomApolloClient(student_Live_Token);
    // test as teacher
    it("get Token as Teacher", async () => {
        const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
        
        const roomId = query.data.token.roomId;
        const name = query.data.token.userName;
        const teacher = query.data.token.isTeacher;
        expect(typeof roomId === "string").toBe(true);
        expect(typeof name === "string").toBe(true);
        expect(teacher).toBe(true);
    });

    // test as student
    it("get Token as Student", async () => {
        const query = await clientStudent.createQuery({query: QUERY_TOKEN});

        const roomId = query.data.token.roomId;
        const name = query.data.token.userName;
        const teacher = query.data.token.isTeacher;
        expect(typeof roomId === "string").toBe(true);
        expect(typeof name === "string").toBe(true);
        expect(teacher).toBe(false);
    });

};
