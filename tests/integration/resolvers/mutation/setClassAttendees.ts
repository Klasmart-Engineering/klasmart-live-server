import { MUTATION_SET_CLASS_ATTENDEES } from "../../graphql/mutation";
import { QUERY_TOKEN } from "../../graphql/query";
import { CustomApolloClient } from "../../apolloClient";
import { ClassType } from "../../../../src/types";
import { getToken } from "../../mockData/generateToken";
import { classAttendeesMockData } from "../../mockData/resolverMock";
/**
 * This request comes from teacher only in class(class)
 */
export const setClassAttendees = () => {
    const teacher_Live_Token = getToken (ClassType.LIVE, true, false, false);
    const clientTeacher = new CustomApolloClient(teacher_Live_Token);

    it("set class Attendees", async () => {
        const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
        const roomId = query.data.token.roomId;
        const result = await clientTeacher.createMutation({
          query: MUTATION_SET_CLASS_ATTENDEES, variables: {
            roomId,
            userIds: classAttendeesMockData(5)
          }});
        expect(result.data.setClassAttendees).toBe(true);
        clientTeacher.stop();
    });

};
