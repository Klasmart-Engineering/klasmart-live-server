import { QUERY_READY } from "../graphql/query";
import { QUERY_TOKEN } from "../graphql/query";
import { CustomApolloClient } from "../apolloClient";
import { ClassType } from "../../../src/types";
import { getToken } from "../mockData/generateToken";

export const queries = () => {
    const teacher_Live_Token = getToken (ClassType.LIVE, true, false, false);
    const student_Live_Token = getToken (ClassType.LIVE, false, false, false);
    const clientTeacher = new CustomApolloClient(teacher_Live_Token);
    const clientStudent = new CustomApolloClient(student_Live_Token);

    afterAll(() => {
        clientTeacher.stop();
        clientStudent.stop();
    })
    describe('ready', () => {
        //Teacher
        it("should resolve true when queries as Teacher", async () => {
            const query = await clientTeacher.createQuery({query: QUERY_READY});
            expect(query.data.ready).toBe(true);
        });
    
        //Student
        it("should resolve true when queries as Student", async () => {
            const query = await clientStudent.createQuery({query: QUERY_READY});
            expect(query.data.ready).toBe(true);
            
        });
    })

    describe('token', () => {
        // Teacher
        it("should resolve true when Teacher sends request to get Token", async () => {
            const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
            
            const roomId = query.data.token.roomId;
            const name = query.data.token.userName;
            const teacher = query.data.token.isTeacher;
            expect(typeof roomId === "string").toBe(true);
            expect(typeof name === "string").toBe(true);
            expect(teacher).toBe(true);
        });

        // Student
        it("should resolve true when Student sends request to get Token", async () => {
            const query = await clientStudent.createQuery({query: QUERY_TOKEN});

            const roomId = query.data.token.roomId;
            const name = query.data.token.userName;
            const teacher = query.data.token.isTeacher;
            expect(typeof roomId === "string").toBe(true);
            expect(typeof name === "string").toBe(true);
            expect(teacher).toBe(false);
        });
    })
}

