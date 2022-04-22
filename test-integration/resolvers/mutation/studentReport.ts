import { MUTATION_SEND_STUDENT_USAGE_RECORD_EVENT } from "../../graphql/mutation";
import { QUERY_TOKEN } from "../../graphql/query";
import { CustomApolloClient } from "../../apolloClient";
import { ClassType } from "../../../src/types";
import { getToken } from "../../mockData/generateToken";
import { studentReportMockData } from "../../mockData/resolverMock";

/**Thep API is called When teacher changes activity in class(live, class) 
* or student changes activity in class(study) */
export const studentReport = () => {
    const teacher_Live_Token = getToken (ClassType.LIVE, true, false, false);
    const clientTeacher = new CustomApolloClient(teacher_Live_Token);

    it("report student activities", async () => {
        const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
        const roomId = query.data.token.roomId;
        const result = await clientTeacher.createMutation({
          query: MUTATION_SEND_STUDENT_USAGE_RECORD_EVENT, variables: {
            roomId,
            materialUrl: studentReportMockData.materialUrl,
            activityTypeName: studentReportMockData.activityTypeName
          }});
        expect(result.data.whiteboardSendEvent).toBe(true);
    });

    it("report student activities without materialURl", async () => {
      const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
      const roomId = query.data.token.roomId;
      const result = await clientTeacher.createMutation({
        query: MUTATION_SEND_STUDENT_USAGE_RECORD_EVENT, variables: {
          roomId,
          activityTypeName: studentReportMockData.activityTypeName
        }});
      expect(result.data.whiteboardSendEvent).toBe(false);
    });

    it("report student activities without activityTypeName", async () => {
      const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
      const roomId = query.data.token.roomId;
      const result = await clientTeacher.createMutation({
        query: MUTATION_SEND_STUDENT_USAGE_RECORD_EVENT, variables: {
          roomId,
          materialUrl: studentReportMockData.materialUrl
        }});
      expect(result.data.whiteboardSendEvent).toBe(false);
    });

};
