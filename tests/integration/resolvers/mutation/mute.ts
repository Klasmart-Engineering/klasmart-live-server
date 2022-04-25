import { MUTATION_MUTE } from "../../graphql/mutation";
import { QUERY_TOKEN } from "../../graphql/query";
import { CustomApolloClient } from "../../apolloClient";
import { ClassType } from "../../../../src/types";
import { getToken } from "../../mockData/generateToken";
import { getRandomBoolean, getUniqueId } from "../../mockData/functions";

export const mute = () => {
    const teacher_Live_Token = getToken (ClassType.LIVE, true, false, false);
    const student_Live_Token = getToken (ClassType.LIVE, false, false, false);
    const clientTeacher = new CustomApolloClient(teacher_Live_Token);
    const clientStudent = new CustomApolloClient(student_Live_Token);
    const sessionId = getUniqueId();
    const audio = getRandomBoolean();
    const video = getRandomBoolean();
    it("mute&unmute audio and video as Teacher", async () => {
      const query = await clientTeacher.createQuery({query: QUERY_TOKEN})
      const roomId = query.data.token.roomId;

      const result = await clientTeacher.createMutation({
        query: MUTATION_MUTE, variables: {
          roomId, 
          sessionId,
          audio,
          video,
        }});
      expect(result.data.mute).toBe(true);
    });
    
    it("mute&unmute audio and video as Student", async () => {
        const query = await clientStudent.createQuery({query: QUERY_TOKEN})
        const roomId = query.data.token.roomId;

        const result = await clientStudent.createMutation({
          query: MUTATION_MUTE, variables: {
            roomId, 
            sessionId,
            audio,
            video,
          }});
        expect(result.data.mute).toBe(true);
    });

};
