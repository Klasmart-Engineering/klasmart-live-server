
import { SUBSCRIPTION_ROOM } from "../../graphql/subscription";
import { MUTATION_LEAVECLASS, MUTATION_SEND_MESSAGE, 
    MUTATION_REWARD_TROPHY } from "../../graphql/mutation";
import { QUERY_TOKEN } from "../../graphql/query";
import { CustomApolloClient } from "../../apolloClient";
import { ClassType } from "../../../../src/types";
import { ContentType } from "../../mockData/types";
import { getToken } from "../../mockData/generateToken";
import { getUniqueId } from "../../mockData/functions";
import { rewardThropyMockData } from "../../mockData/resolverMock";

/**
 * TODO: test canse for room.sfu
 * to test sfu we might need to 
 */
export const room = () => {
    const roomid = getUniqueId();
    const teacher_Live_Token = getToken (ClassType.LIVE, true, false, false, roomid);
    const student_Live_Token = getToken (ClassType.LIVE, false, false, false, roomid);
    const clientTeacher = new CustomApolloClient(teacher_Live_Token);
    const clientStudent = new CustomApolloClient(student_Live_Token);
  

    it("SUBSCRIPTION test room.join", async () => {
    /**
     * 1. Teacher subscribe
     * 2. Student subscribe
     * 3. Check if teacher get notification about Student join
     * 4. Check if teacher and student get notification about content
     *    content is the first notificaiton users get after join room
    */

        const queryTeacher = await clientTeacher.createQuery({query: QUERY_TOKEN});
        const roomId = queryTeacher.data.token.roomId;
        const queryStudent = await clientStudent.createQuery({query: QUERY_TOKEN});

        // 1
        const teacherSub = await clientTeacher.createSubscription({
            query: SUBSCRIPTION_ROOM, 
            variables: {roomId}
        });

        await teacherSub.wait(1000);

        // 2
        const studentSub = await clientStudent.createSubscription({
            query: SUBSCRIPTION_ROOM, 
            variables: {roomId}
        });

        await teacherSub.wait(1000);

        // 3
        expect(studentSub.results[0].data.room.content.type).toEqual(ContentType.Blank);
        expect(teacherSub.results[0].data.room.content.type).toEqual(ContentType.Blank);
    
        // 4
        expect(teacherSub.results[2].data.room.join.name).toEqual(queryStudent.data.token.userName);

        // unsubscribe clients
        teacherSub.disconnect();
        studentSub.disconnect();
    
    });

    it("SUBSCRIPTION test room.leave", async () => {
    /**
     * 1. Teacher subscribe
     * 2. Student subscribe
     * 3. Student leave class 
     * 4. Check if Teacher get message about user who left the class from server
    */

        const queryTeacher = await clientTeacher.createQuery({query: QUERY_TOKEN});
        const roomId = queryTeacher.data.token.roomId;

        // 1
        const teacherSub = await clientTeacher.createSubscription({
            query: SUBSCRIPTION_ROOM, 
            variables: {roomId}
        });
        await teacherSub.wait(1000);

        // 2
        const studentSub = await clientStudent.createSubscription({
            query: SUBSCRIPTION_ROOM, 
            variables: {roomId}
        });

        await studentSub.wait(1000);
        // 3
        await clientStudent.createMutation({query: MUTATION_LEAVECLASS, variables: {roomId}});
        await teacherSub.wait(2000);
        // 4
        teacherSub.results.forEach((res) => {
            if(res.data.room?.leave){
                console.log('TEACHER room.leave :', res.data.room.leave);
            }
        })
        expect(teacherSub.results[3].data.room.leave.id).toEqual(studentSub.results[2].data.room.join.id);
     
        // unsubscribe clients
        studentSub.disconnect();
        teacherSub.disconnect();
    });

    it("SUBSCRIPTION test room.message", async () => {
    /**
     * 1. Teacher subscribe
     * 2. Student subscribe
     * 3. Teacher send message in chat
     * 4. Check if Student receives message
    */

        const queryTeacher = await clientTeacher.createQuery({query: QUERY_TOKEN});
        const roomId = queryTeacher.data.token.roomId;

        // 1
        const teacherSub = await clientTeacher.createSubscription({
            query: SUBSCRIPTION_ROOM, 
            variables: {roomId}
        });
        await teacherSub.wait(1000);

        // 2
        const studentSub = await clientStudent.createSubscription({
            query: SUBSCRIPTION_ROOM, 
            variables: {roomId}
        });
        await studentSub.wait(1000);

        // 3
        const message = "message from Teacher";
        await clientTeacher.createMutation({query: MUTATION_SEND_MESSAGE, variables: {roomId, message}});

        await teacherSub.wait(1000);
        // 4
        expect(studentSub.results[3].data.room.message.message).toEqual(message);

        // unsubscribe clients
        studentSub.disconnect();
        teacherSub.disconnect();
    });

    it("SUBSCRIPTION test room.trophy", async () => {
    /**
     * 1. Teacher subscribe
     * 2. Student subscribe
     * 3. Teacher send Trophy
     * 4. Check if Student receives trophy
    */

        const queryTeacher = await clientTeacher.createQuery({query: QUERY_TOKEN});
        const roomId = queryTeacher.data.token.roomId;
        const queryStudent = await clientStudent.createQuery({query: QUERY_TOKEN});
        const studentId = queryStudent.data.token.userId;
        // 1
        const teacherSub = await clientTeacher.createSubscription({
            query: SUBSCRIPTION_ROOM, 
            variables: {roomId}
        });
        await teacherSub.wait(1000);

        // 2
        const studentSub = await clientStudent.createSubscription({
            query: SUBSCRIPTION_ROOM, 
            variables: {roomId}
        });
        await studentSub.wait(1000);

        // 3
        const kind = rewardThropyMockData.kind;
        await clientTeacher.createMutation({
            query: MUTATION_REWARD_TROPHY, variables: {
                roomId, 
                user: studentId,
                kind
            }});

        await studentSub.wait(1000);
        // 4
        studentSub.results.forEach((res) => {
            console.log("res: ", res.data.room);
        });
        expect(studentSub.results[4].data.room.trophy.from).toEqual(teacherSub.results[1].data.room.join.id);
        expect(studentSub.results[4].data.room.trophy.kind).toEqual(kind);
  
        // unsubscribe clients
        studentSub.disconnect();
        teacherSub.disconnect();

        clientTeacher.stop();
        clientStudent.stop();
    });
};