import { MUTATION_REWARD_TROPHY } from "../../graphql/mutation";
import { QUERY_TOKEN } from "../../graphql/query";
import { CustomApolloClient } from "../../apolloClient";
import { ClassType } from "../../../../src/types";
import { getToken } from "../../mockData/generateToken";
import { rewardThropyMockData } from "../../mockData/resolverMock";

export const rewardTrophy = () => {
  const teacher_Live_Token = getToken (ClassType.LIVE, true, false, false);
  const student_Live_Token = getToken (ClassType.LIVE, false, false, false);
  const clientTeacher = new CustomApolloClient(teacher_Live_Token);
  const clientStudent = new CustomApolloClient(student_Live_Token);
  

    it("rewardTrophy as Teacher", async () => {
      const query = await clientTeacher.createQuery({query: QUERY_TOKEN})
      const queryStudent = await clientStudent.createQuery({query: QUERY_TOKEN})
      const roomId = query.data.token.roomId;
      const userId = queryStudent.data.token.userId;

      const result = await clientTeacher.createMutation({
        query: MUTATION_REWARD_TROPHY, variables: {
          roomId, 
          user: userId,
          kind: rewardThropyMockData.kind
      }});
      
      expect(result.data.rewardTrophy).toBe(true);
      clientTeacher.stop();
      clientStudent.stop();
    });

};
