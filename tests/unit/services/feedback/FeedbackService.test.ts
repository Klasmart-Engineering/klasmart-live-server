import { FeedbackService } from "../../../../src/services/feedback/FeedbackService";
import { Cluster } from "ioredis";
import { Context } from "../../../../src/types";

jest.setTimeout(20*1000);
describe("FeedbackService",() => {

    // Mock redis cluster
    const fakeRedisCluster = {
        expire: jest.fn(),
        xadd: jest.fn(),
    } as any as Cluster;
  
    describe("rewardTrophy", () => {
        afterEach(() => {
            delete process.env.ATTENDANCE_SERVICE_ENDPOINT;
        });
        const testAttendanceService = new FeedbackService(fakeRedisCluster);
        const defaultContext = {
            authorizationToken: {
                roomId: "roomId",
            }
        } as any as Context;


        it("should resolve falsy if session.id is not defined in context", async () => {
            const testUser = "test-user";
            const testKind = "test-kind";
            await expect(testAttendanceService.rewardTrophy(defaultContext, testUser, testKind)).rejects.toBeTruthy();
        });


        it("should return true if eveything works well", async () => {
            // setup mock
            (fakeRedisCluster.expire as jest.Mock).mockResolvedValue(1);
            (fakeRedisCluster.xadd as jest.Mock).mockResolvedValue(1);

            const testContext = {
                authorizationToken: {
                    roomId: "roomId",
                },
                sessionId: "sessionId"
            } as any as Context;
            const testUser = "test-user";
            const testKind = "test-kind";

            const received = await testAttendanceService.rewardTrophy(testContext, testUser, testKind);
            expect(received).toBeTruthy();
        });

    });

    describe("saveFeedback", () => {
        afterEach(() => {
            delete process.env.ATTENDANCE_SERVICE_ENDPOINT;
        });

        const testAttendanceService = new FeedbackService(fakeRedisCluster);
        const stars = 4;
        const feedbackType = "feedbackType";
        const comment = "comment";
        const quickFeedback = [
            {
                type: "type1", stars: 5
            },
            {
                type: "type2", stars: 4
            },
        ];

        const authorizationToken = {
            roomId: "roomid",
            userId: "userid",
            sessionId: "sessionId",
            stars,
            comment,
            feedbackType,
            quickFeedback,
        };
        const sessionId = "sessionId";
    

        it("should resolve falsy if authorizationToken is undefined in context", async () => {
            process.env.ATTENDANCE_SERVICE_ENDPOINT = "https://attendence.endpoint.net";
            const context = {
                sessionId
            } as any as Context;

            const received = await testAttendanceService.saveFeedback(context, stars,feedbackType,comment,quickFeedback);
            expect(received).toBeFalsy();
        });

        it("should resolve falsy if sessionId is undefined in context", async () => {
            process.env.ATTENDANCE_SERVICE_ENDPOINT = "https://attendence.endpoint.net";
            const context = {
                authorizationToken
            } as any as Context;
            const received = await testAttendanceService.saveFeedback(context, stars,feedbackType,comment,quickFeedback);
            expect(received).toBeFalsy();
        });

        it("should resolve falsy if ATTENDANCE_SERVICE_ENDPOINT is undefined", async () => {
            const context = {
                authorizationToken,
                sessionId
            } as any as Context;
            const received = await testAttendanceService.saveFeedback(context, stars,feedbackType,comment,quickFeedback);
            expect(received).toBeFalsy();
        });

        it("should resolve truth if everthing works well", async () => {
            process.env.ATTENDANCE_SERVICE_ENDPOINT = "https://attendence.endpoint.net";
            const context = {
                authorizationToken,
                sessionId
            } as any as Context;
            const received = await testAttendanceService.saveFeedback(context, stars,feedbackType,comment,quickFeedback);
            expect(received).toBeTruthy();

        });
    });
});