import { FeedbackService } from "../../../../src/services/feedback/FeedbackService";
import { Cluster } from "ioredis";
import { Context } from "../../../../src/types";

describe("FeedbackService",() => {

  // Mock redis cluster
  const fakeRedisCluster = {
    expire: jest.fn(),
    xadd: jest.fn(),
  } as any as Cluster;

  describe("rewardTrophy", () => {
    afterEach(() => {
      delete process.env.ATTENDANCE_SERVICE_ENDPOINT;
    })
    const testAttendanceService = new FeedbackService(fakeRedisCluster);
    const defaultContext = {
      authorizationToken: {
        roomId: 'roomId',
      }
    } as any as Context


    it("should resolve falsy if session.id is not defined in context", async () => {
      const testUser = 'test-user';
      const testKind = 'test-kind';
      await expect(testAttendanceService.rewardTrophy(defaultContext, testUser, testKind)).rejects.toBeTruthy();
    })


    it("should return true if eveything works well", async () => {
      // setup mock
      (fakeRedisCluster.expire as jest.Mock).mockResolvedValue(1);
      (fakeRedisCluster.xadd as jest.Mock).mockResolvedValue(1);

      const testContext = {
        authorizationToken: {
          roomId: 'roomId',
        },
        sessionId: "sessionId"
      } as any as Context
      const testUser = 'test-user';
      const testKind = 'test-kind';

      const received = await testAttendanceService.rewardTrophy(testContext, testUser, testKind);
      expect(received).toBeTruthy();
    })

  })
})