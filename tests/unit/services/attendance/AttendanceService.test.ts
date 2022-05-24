import { AttendanceService } from "../../../../src/services/attendance/AttendanceService";
import { Cluster } from "ioredis";
import { Session } from "../../../../src/types";
import { ClassType } from "../../../../src/types";

describe("AttendanceService",() => {

   // Mock redis cluster
   const fakeRedisCluster = {} as any as Cluster;

  const defaultRoomId = 'room-id';

  describe("log", () => {
    afterEach(() => {
      delete process.env.ATTENDANCE_SERVICE_ENDPOINT;
    })
    const testAttendanceService = new AttendanceService(fakeRedisCluster);
    const defaultSession = {
      id: "test-id",
      userId: "test-user-id",
      name: "test-name",
      streamId: "test-stream-id",
      isTeacher: true,
      isHost: true,
      joinedAt: 234,
      email: 234,
    } as any as Session


    it("should resolve false when ATTENDANCE_SERVICE_ENDPOINT env value is falsy", async () => {
      const getRoomContextSpy = jest.spyOn(testAttendanceService as any, "getRoomContext");
      getRoomContextSpy.mockImplementation(() => {
        return {
            classType: ClassType.LIVE,
            startAt: 234,
            endAt: 1234,
          } 
        }
      )
      const received = await testAttendanceService.log(defaultRoomId, defaultSession);
      expect(received).toBeFalsy();
    })

    it("should resolve false when roomContext is falsy", async () => {
      process.env.ATTENDANCE_SERVICE_ENDPOINT = "attendance service endoint";
      const getRoomContextSpy = jest.spyOn(testAttendanceService as any, "getRoomContext");
      getRoomContextSpy.mockImplementation(() => {
        return undefined
        }
      )
      const received = await testAttendanceService.log(defaultRoomId, defaultSession);
      expect(received).toBeFalsy();
    })

    it("should resolve false when session.id is falsy", async () => {
      process.env.ATTENDANCE_SERVICE_ENDPOINT = "attendance service endoint";
      const getRoomContextSpy = jest.spyOn(testAttendanceService as any, "getRoomContext");
      getRoomContextSpy.mockImplementation(() => {
        return {
          classType: ClassType.LIVE,
          startAt: 234,
          endAt: 1234,
        } 
      })

      const received = await testAttendanceService.log(defaultRoomId, {} as Session);
      expect(received).toBeFalsy();
    })

    it("should resolve true if data send to cms service", async () => {
      process.env.ATTENDANCE_SERVICE_ENDPOINT = "https://attendanceServiceEndpiont.com";
      const getRoomContextSpy = jest.spyOn(testAttendanceService as any, "getRoomContext");
      getRoomContextSpy.mockImplementation(() => {
        return {
          classType: ClassType.LIVE,
          startAt: 234,
          endAt: 1234,
        } 
      })

      const received = await testAttendanceService.log(defaultRoomId, defaultSession);
      expect(received).toBeTruthy();
    })

  })

  describe("send", () => {
    afterEach(() => {
      delete process.env.ATTENDANCE_SERVICE_ENDPOINT;
    })
    const testAttendanceService = new AttendanceService(fakeRedisCluster);

    it("should resolve false when ATTENDANCE_SERVICE_ENDPOINT env value is falsy", async () => {
      const getRoomContextSpy = jest.spyOn(testAttendanceService as any, "getRoomContext");
      getRoomContextSpy.mockImplementation(() => {
        return {
            classType: ClassType.LIVE,
            startAt: 234,
            endAt: 1234,
          } 
        }
      )
      const received = await testAttendanceService.send(defaultRoomId);
      expect(received).toBeFalsy();
    });

    it("should resolve false when roomContext is falsy", async () => {
      process.env.ATTENDANCE_SERVICE_ENDPOINT = "attendance service endoint";
      const getRoomContextSpy = jest.spyOn(testAttendanceService as any, "getRoomContext");
      getRoomContextSpy.mockImplementation(() => {
        return undefined
        }
      )
      const received = await testAttendanceService.send(defaultRoomId);
      expect(received).toBeFalsy();
    })

    it("should resolve true if data send to cms service", async () => {
      process.env.ATTENDANCE_SERVICE_ENDPOINT = "https://attendanceServiceEndpiont.com";
      const getRoomContextSpy = jest.spyOn(testAttendanceService as any, "getRoomContext");
      getRoomContextSpy.mockImplementation(() => {
        return {
          classType: ClassType.LIVE,
          startAt: 234,
          endAt: 1234,
        } 
      })

      const received = await testAttendanceService.send(defaultRoomId);
      expect(received).toBeTruthy();
    })

  })

  describe("schedule", () => {
    afterEach(() => {
      delete process.env.ATTENDANCE_SERVICE_ENDPOINT;
    })
    const testAttendanceService = new AttendanceService(fakeRedisCluster);

    it("should resolve false when ATTENDANCE_SERVICE_ENDPOINT env value is falsy", async () => {
      const getRoomContextSpy = jest.spyOn(testAttendanceService as any, "getRoomContext");
      getRoomContextSpy.mockImplementation(() => {
        return {
            classType: ClassType.LIVE,
            startAt: 234,
            endAt: 1234,
          } 
        }
      )
      const received = await testAttendanceService.schedule(defaultRoomId);
      expect(received).toBeFalsy();
    });

    it("should resolve false when roomContext is falsy", async () => {
      process.env.ATTENDANCE_SERVICE_ENDPOINT = "attendance service endoint";
      const getRoomContextSpy = jest.spyOn(testAttendanceService as any, "getRoomContext");
      getRoomContextSpy.mockImplementation(() => {
        return undefined
        }
      )
      const received = await testAttendanceService.schedule(defaultRoomId);
      expect(received).toBeFalsy();
    })

    it("should resolve true if data send to cms service", async () => {
      process.env.ATTENDANCE_SERVICE_ENDPOINT = "https://attendanceServiceEndpiont.com";
      const getRoomContextSpy = jest.spyOn(testAttendanceService as any, "getRoomContext");
      getRoomContextSpy.mockImplementation(() => {
        return {
          classType: ClassType.LIVE,
          startAt: 234,
          endAt: 1234,
        } 
      })

      const received = await testAttendanceService.schedule(defaultRoomId);
      expect(received).toBeTruthy();
    })
  })
})