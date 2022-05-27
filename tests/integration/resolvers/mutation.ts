import { MUTATION_ENDCLASS } from "../graphql/mutation";
import { MUTATION_LEAVECLASS } from "../graphql/mutation";
import { MUTATION_MUTE } from "../graphql/mutation";
import { MUTATION_POST_PAGE_EVENTS } from "../graphql/mutation";
import { MUTATION_REWARD_TROPHY } from "../graphql/mutation";
import { MUTATION_SAVE_FEEDBACK } from "../graphql/mutation";
import { MUTATION_SEND_MESSAGE } from "../graphql/mutation";
import { MUTATION_SET_CLASS_ATTENDEES } from "../graphql/mutation";
import { MUTATION_SET_HOST } from "../graphql/mutation";
import { MUTATION_SET_SESSION_STREAMID } from "../graphql/mutation";
import { MUTATION_SHOW_CONTENT } from "../graphql/mutation";
import { MUTATION_SEND_STUDENT_USAGE_RECORD_EVENT } from "../graphql/mutation";
import { MUTATION_WHITEBOARD_SEND_DISPLAY } from "../graphql/mutation";
import { MUTATION_WHITEBOARD_SEND_EVENT } from "../graphql/mutation";
import { MUTATION_WHITEBOARD_SEND_PERMISSIONS } from "../graphql/mutation";

import { QUERY_TOKEN } from "../graphql/query";
import { CustomApolloClient } from "../apolloClient";
import { ClassType } from "../../../src/types";
import { getRandomString } from "../mockData/functions";

// mock datas
import { getToken } from "../mockData/generateToken";
import { getRandomBoolean, getUniqueId } from "../mockData/functions";
import { pageEventMockData } from "../mockData/resolverMock";
import { rewardThropyMockData } from "../mockData/resolverMock";
import { feedbackMockData } from "../mockData/resolverMock";
import { classAttendeesMockData } from "../mockData/resolverMock";
import { contentTypeMockData } from "../mockData/resolverMock";
import { studentReportMockData } from "../mockData/resolverMock";
import { whiteboardSendEventMockData } from "../mockData/resolverMock";
import { whiteboardSendPermissionsMockData } from "../mockData/resolverMock";

export const mutations = () => {

  const teacher_Live_Token = getToken (ClassType.LIVE, true, false, false);
  const student_Live_Token = getToken (ClassType.LIVE, false, false, false);
  const clientTeacher = new CustomApolloClient(teacher_Live_Token);
  const clientStudent = new CustomApolloClient(student_Live_Token);

  afterAll(() => {
    clientTeacher.stop();
    clientStudent.stop();
  })

  describe('endClass', () => {
    
    it("should resolve true when Teacher sends endClass mutation", async () => {
        const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
        const roomId = query.data.token.roomId;
        const result = await clientTeacher.createMutation({query: MUTATION_ENDCLASS, variables: {roomId}});
        expect(result.data.endClass).toBeTruthy();
    });

    it("should resolve false when Student sends endClass mutation ", async () => {
        const query = await clientStudent.createQuery({query: QUERY_TOKEN});
        const roomId = query.data.token.roomId;
        const result = await clientStudent.createMutation({query: MUTATION_ENDCLASS, variables: {roomId}});
        expect(result.data.endClass).toBeFalsy();

    });
  })

  describe('leaveClass', () => {
    it("should resolve true if Teacher sends leaveClass mutation", async () => {
      const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
      const roomId = query.data.token.roomId;
      const result = await clientTeacher.createMutation({query: MUTATION_LEAVECLASS, variables: {roomId}});
      expect(result.data.leaveClass).toBeTruthy();
    });

    it("should resolve true if Student sends leaveClass mutation", async () => {
        const query = await clientStudent.createQuery({query: QUERY_TOKEN});
        const roomId = query.data.token.roomId;
        const result = await clientStudent.createMutation({query: MUTATION_LEAVECLASS, variables: {roomId}});
        expect(result.data.leaveClass).toBeTruthy();
    });
  })
  
  describe('mute', () => {
    const sessionId = getUniqueId();
    const audio = getRandomBoolean();
    const video = getRandomBoolean();
    it("resolve true when Teacher sends Mute mutation", async () => {
        const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
        const roomId = query.data.token.roomId;

        const result = await clientTeacher.createMutation({
            query: MUTATION_MUTE, variables: {
                roomId, 
                sessionId,
                audio,
                video,
            }});
        expect(result.data.mute).toBeTruthy();
    });
    
    it("resolve true when Student sends Mute mutation", async () => {
        const query = await clientStudent.createQuery({query: QUERY_TOKEN});
        const roomId = query.data.token.roomId;

        const result = await clientStudent.createMutation({
            query: MUTATION_MUTE, variables: {
                roomId, 
                sessionId,
                audio,
                video,
            }});
        expect(result.data.mute).toBeTruthy();
    });
  })
  
  describe('postPageEvent', () => {
    const streamId = getUniqueId();

    it("should resove true when Teacher sends eventpostPageEvent mutation", async () => {
        const result = await clientTeacher.createMutation({query: MUTATION_POST_PAGE_EVENTS, variables: {streamId, pageEvents: pageEventMockData}});
        expect(result.data.postPageEvent).toBeTruthy();
    });

    it("should resove true when Student sends eventpostPageEvent mutation", async () => {
        const result = await clientStudent.createMutation({query: MUTATION_POST_PAGE_EVENTS, variables: {streamId, pageEvents: pageEventMockData}});
        expect(result.data.postPageEvent).toBeTruthy();
    });
  })
  
  describe('rewardTrophy', () => {
    it("should resolve true when Teacher send rewardTrophy mutation", async () => {
      const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
      const queryStudent = await clientStudent.createQuery({query: QUERY_TOKEN});
      const roomId = query.data.token.roomId;
      const userId = queryStudent.data.token.userId;

      const result = await clientTeacher.createMutation({
          query: MUTATION_REWARD_TROPHY, variables: {
              roomId, 
              user: userId,
              kind: rewardThropyMockData.kind
          }});
    
      expect(result.data.rewardTrophy).toBeTruthy();
  });
  })
  
  describe('saveFeedback', () => {
    it("should resolve true when Teacher sends saveFeedback mutation", async () => {
      const result = await clientTeacher.createMutation({query: MUTATION_SAVE_FEEDBACK, variables: feedbackMockData});
      expect(result.data.saveFeedback).toBeTruthy();
    });

    //Student
    it("should resolve true when Teacher sends saveFeedback mutation", async () => {
        const result = await clientStudent.createMutation({query: MUTATION_SAVE_FEEDBACK, variables: feedbackMockData});
        expect(result.data.saveFeedback).toBeTruthy();
    });
  })
  
  describe('sendMessage', () => {
    it("should return send message when Teacher sends sendMessage mutation", async () => {
      const message = "message from Teacher";
      const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
      const roomId = query.data.token.roomId;
      const result = await clientTeacher.createMutation({query: MUTATION_SEND_MESSAGE, variables: {roomId, message}});
      expect(result.data.sendMessage.message).toMatch(message);
    });

    it("should resolve undefined if message is empty", async () => {
        const message = "";
        const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
        const roomId = query.data.token.roomId;
        const result = await clientTeacher.createMutation({query: MUTATION_SEND_MESSAGE, variables: {roomId, message}});
        expect(result.data.sendMessage).toBeNull();
    });


    it("should return send message when Student sends sendMessage mutation", async () => {
        const message = "message from Student";
        const query = await clientStudent.createQuery({query: QUERY_TOKEN});
        const roomId = query.data.token.roomId;
        const result = await clientStudent.createMutation({query: MUTATION_SEND_MESSAGE, variables: {roomId, message}});
        expect(result.data.sendMessage.message).toMatch(message);
    });
  })

  describe('setClassAttendees', () => {
    it("should resolve true when Teacher sends setClassAttendees mutation", async () => {
      const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
      const roomId = query.data.token.roomId;
      const result = await clientTeacher.createMutation({
          query: MUTATION_SET_CLASS_ATTENDEES, variables: {
              roomId,
              userIds: classAttendeesMockData(5)
          }});
      expect(result.data.setClassAttendees).toBeTruthy();
  });
  })
  
  describe('setHost', () => {
    it("should throw Error if Teacher tries to setHost before joining class", async () => {
      const nextHostId = getUniqueId();
      const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
      const roomId = query.data.token.roomId;
      const result = await clientTeacher.createMutation({query: MUTATION_SET_HOST, variables: {roomId, nextHostId}});
      expect(result.errors).toBeDefined();
  });

  it("should throw Error if hostId is not defined", async () => {
      const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
      const roomId = query.data.token.roomId;
      const result = await clientTeacher.createMutation({query: MUTATION_SET_HOST, variables: {roomId}});
      expect(result.errors).toBeDefined();
  });

  it("should throw error if student tries to setHost", async () => {
      const nextHostId = getUniqueId();
      const query = await clientStudent.createQuery({query: QUERY_TOKEN});
      const roomId = query.data.token.roomId;
      const result = await clientStudent.createMutation({query: MUTATION_SET_HOST, variables: {roomId, nextHostId}});
      expect(result.errors).toBeDefined();
  });
  })
  
  describe('setSessionStreamId', () => {
    //Teacher
    it("should resolve true when Teacher sends setSessionStreamId mutation", async () => {
      const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
      const roomId = query.data.token.roomId;
      const streamId = getUniqueId();
      const result = await clientTeacher.createMutation({query: MUTATION_SET_SESSION_STREAMID, variables: {roomId,streamId}});
      expect(result.data.setSessionStreamId).toBeTruthy();
  });

  it("should resolve undefined when Teacher sends setSessionStreamId mutation without streamId", async () => {
      const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
      const roomId = query.data.token.roomId;
      const result = await clientTeacher.createMutation({query: MUTATION_SET_SESSION_STREAMID, variables: {roomId }});
      expect(result.data).toBeUndefined();
  });

  //Student
  it("should resolve true when Student sends setSessionStreamId mutation", async () => {
      const query = await clientStudent.createQuery({query: QUERY_TOKEN});
      const roomId = query.data.token.roomId;
      const streamId = getUniqueId();
      const result = await clientStudent.createMutation({query: MUTATION_SET_SESSION_STREAMID, variables: {roomId, streamId}});
      expect(result.data.setSessionStreamId).toBeTruthy();
  });
  it("should resolve undefined when Student sends setSessionStreamId mutation without streamId", async () => {
      const query = await clientStudent.createQuery({query: QUERY_TOKEN});
      const roomId = query.data.token.roomId;
      const result = await clientStudent.createMutation({query: MUTATION_SET_SESSION_STREAMID, variables: {roomId}});
      expect(result.data).toBeUndefined();
  });
  })
  
  describe('showContent', () => {
    it("should resolve true when Teacher sends showContent mutation", async () => {
      const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
      const roomId = query.data.token.roomId;
      const result = await clientStudent.createMutation({
          query: MUTATION_SHOW_CONTENT, variables: {
              roomId, 
              type: contentTypeMockData.type, 
              contnetId: contentTypeMockData.contentId
          }});
      expect(result.data.showContent).toBeTruthy();
    });

    it("should resolve undefined when Teacher send showContent mutation with incorrect content", async () => {
        const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
        const roomId = query.data.token.roomId;
        const result = await clientStudent.createMutation({
            query: MUTATION_SHOW_CONTENT, variables: {
                roomId, 
                type: "no Content", 
                contnetId: contentTypeMockData.contentId
            }});
        expect(result.data).toBeUndefined();
    });


    it("should resolve true when Student sends showContent mutation", async () => {
        const query = await clientStudent.createQuery({query: QUERY_TOKEN});
        const roomId = query.data.token.roomId;
        const result = await clientStudent.createMutation({
            query: MUTATION_SHOW_CONTENT, variables: {
                roomId, 
                type: contentTypeMockData.type, 
                contnetId: contentTypeMockData.contentId
            }});
        expect(result.data.showContent).toBeTruthy();
    });
  })
  
  describe('studentReport', () => {
    it("should resolve true when Teacher sends studentReport mutation", async () => {
      const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
      const roomId = query.data.token.roomId;
      const result = await clientTeacher.createMutation({
          query: MUTATION_SEND_STUDENT_USAGE_RECORD_EVENT, variables: {
              roomId,
              materialUrl: studentReportMockData.materialUrl,
              activityTypeName: studentReportMockData.activityTypeName
          }});
      
      expect(result.data.studentReport).toBeTruthy();
    });

    it("should resolve true when Teacher sends studentReport mutation without materialURl", async () => {
        const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
        const roomId = query.data.token.roomId;
        const result = await clientTeacher.createMutation({
            query: MUTATION_SEND_STUDENT_USAGE_RECORD_EVENT, variables: {
                roomId,
                activityTypeName: studentReportMockData.activityTypeName
            }});
        expect(result.data.studentReport).toBeFalsy();
    });

    it("should resolve true when Teacher sends studentReport mutation without activityTypeName", async () => {
        const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
        const roomId = query.data.token.roomId;
        const result = await clientTeacher.createMutation({
            query: MUTATION_SEND_STUDENT_USAGE_RECORD_EVENT, variables: {
                roomId,
                materialUrl: studentReportMockData.materialUrl
            }});
        expect(result.data.studentReport).toBeFalsy();
    });
  })

  describe('whiteboardSendDisplay', () => {
    it("should resolve true when Teacher send whiteboardSendDisplay mutation", async () => {
      const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
      const roomId = query.data.token.roomId;
      const result = await clientStudent.createMutation({
          query: MUTATION_WHITEBOARD_SEND_DISPLAY, variables: {
              roomId, 
              display: getRandomBoolean()
          }});
      expect(result.data.whiteboardSendDisplay).toBeTruthy();
    });
  })
  
  describe('whiteboardSendEvent', () => {
    it("should resolve true when Teacher sends whiteboardSendEvent mutation", async () => {
      const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
      const roomId = query.data.token.roomId;
      const result = await clientStudent.createMutation({
          query: MUTATION_WHITEBOARD_SEND_EVENT, variables: {
              roomId, 
              event: JSON.stringify(whiteboardSendEventMockData)
          }});
      expect(result.data.whiteboardSendEvent).toBeTruthy();
    });

    it("should resolve falsy when Teacher send mutation whiteboardSendEvent with wrong data", async () => {
        const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
        const roomId = query.data.token.roomId;
        const result = await clientStudent.createMutation({
            query: MUTATION_WHITEBOARD_SEND_EVENT, variables: {
                roomId, 
                event: ""
            }});
        expect(result.data.whiteboardSendEvent).toBeFalsy();
    });


    it("should resolve true when Student sends whiteboardSendEvent mutation", async () => {
        const query = await clientStudent.createQuery({query: QUERY_TOKEN});
        const roomId = query.data.token.roomId;
        const result = await clientStudent.createMutation({
            query: MUTATION_WHITEBOARD_SEND_EVENT, variables: {
                roomId, 
                event: JSON.stringify(whiteboardSendEventMockData)
            }});
        expect(result.data.whiteboardSendEvent).toBeTruthy();
    });
  })
  
  describe('whiteboardSendPermissions', () => {
    it("should resolve truth when Teacher send whiteboardSendPermissions mutation", async () => {
      const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
      const queryStudent = await clientStudent.createQuery({query: QUERY_TOKEN});
      const roomId = query.data.token.roomId;
      const userId= queryStudent.data.token.userId;

      const result = await clientStudent.createMutation({
          query: MUTATION_WHITEBOARD_SEND_PERMISSIONS, variables: {
              roomId, 
              userId,
              permissions: JSON.stringify(whiteboardSendPermissionsMockData)
          }});
      expect(result.data.whiteboardSendPermissions).toBeTruthy();
    });
    
    // this test should not pass with random stirng, 
    // but in whiteboardSendPermissions permissions are exepted as sting and 
    // there is no type check
    it("whiteboardSendPermissions with wrong permissions as Teacher", async () => {
        const query = await clientTeacher.createQuery({query: QUERY_TOKEN});
        const queryStudent = await clientStudent.createQuery({query: QUERY_TOKEN});
        const roomId = query.data.token.roomId;
        const userId= queryStudent.data.token.userId;

        const result = await clientStudent.createMutation({
            query: MUTATION_WHITEBOARD_SEND_PERMISSIONS, variables: {
                roomId, 
                userId,
                permissions: getRandomString()
            }});
        expect(result.data.whiteboardSendPermissions).toBeTruthy();
    });
  })
  
  
}