import { ClassService } from "../../../../src/services/class/ClassService";
import { Cluster } from "ioredis";
import { RedisKeys } from "../../../../src/redisKeys";
import { Context } from "../../../../src/types";
import { getRandomString } from "../../../integration/mockData/functions";

describe("ClassService", () => {

    // Mock redis cluster
    const fakeRedisCluster = {
        expire: jest.fn(),
        xadd: jest.fn(),
        hgetall: jest.fn(),
        getset: jest.fn(),
        get: jest.fn(),
        pipeline: jest.fn(),
        set: jest.fn(),
    } as any as Cluster;

    describe("setHost", () => {
        const testClassService = new ClassService(fakeRedisCluster);
        const defaultNextHostId = "next-host-id";
        const defaultContext = {
            authorizationToken: {
                roomid: "test-roomid-string",
                userid: "host-id",
            },
            sessionId: "test-sessionid",
        } as unknown as Context;

        it("should reject if someone tries to change host other then host teacher", async () => {
            // setup mock values
            (fakeRedisCluster.get as jest.Mock).mockResolvedValue("test-id");
            await expect(testClassService.setHost(defaultContext, defaultNextHostId)).rejects.toBeTruthy();
        })

    });

    describe("showContent", () => {
        const testClassService = new ClassService(fakeRedisCluster);
        const defaultContext = {
            authorizationToken: {
                roomid: "test-roomid-string",
            },
            sessionId: "test-sessionid",
        } as unknown as Context;
        const notifyRoomSpy = jest.spyOn(testClassService as any, "notifyRoom");

        it("should resolve when content is sent", async () => {
            // setup mock implementations
            notifyRoomSpy.mockImplementation(async () => {})
            const received = await testClassService.showContent(defaultContext, "type", "contentId");
            expect(received).toBeTruthy();
        })
    })

    describe("webRTCSignal", () => {
        const testClassService = new ClassService(fakeRedisCluster);
        const defaultContext = {
            authorizationToken: {
                roomid: "test-roomid-string",
            }
        } as unknown as Context;

        it("should reject when sessionId is falsy", async () => {
            await expect(testClassService.webRTCSignal(defaultContext, "test-id", "random message")).rejects.toBeTruthy();
        })

    });

    describe("sendMessage", () => {
        const testClassService = new ClassService(fakeRedisCluster);
        const defaultContext = {
            authorizationToken: {
                roomid: "test-roomid-string",
            },
            sessionId: "test-sessionid",
        } as unknown as Context;

        const defaultMessage = "default test message";
        const roomMessagesSpy = jest.spyOn(RedisKeys, "roomMessages");
        roomMessagesSpy.mockReturnValue({
            key: "test-key",
            ttl: 1
        });
        const getSessionSpy = jest.spyOn(testClassService as any, "getSession");
        getSessionSpy.mockImplementation(async () => {
            return {
                id: "test-id",
                userId: "test-userId",
                name: "test-name",
                streamId: "test-streamId",
                email: "test-email",
                isTeacher: true,
                isHost: true,
                joinedAt: 2234234
            }
        })

        it("should reject when context.sessionId is falsy", async () => {
            const badContext = {
                authorizationToken: {
                    roomid: "test-roomid"
                }
            } as unknown as Context;
            await expect(
                testClassService.sendMessage(badContext, defaultMessage)
            ).rejects.toBeTruthy();
        });

        it("should resolve to undefined when message is falsy", async () => {
            await expect(
                testClassService.sendMessage(defaultContext, "")
            ).resolves.toBeUndefined();
        });

        it("should resolve to object when xadd returns truthy id", async () => {
            // Setup mock implementations
            (fakeRedisCluster.xadd as jest.Mock).mockResolvedValue(1);
            const received = await testClassService.sendMessage(defaultContext, defaultMessage)
            expect(
                received
            ).toBeInstanceOf(Object);
        });

        it("should resolve with long messages truncated to a maximum length of 1024", async () => {
            // Setup mock implementations
            (fakeRedisCluster.xadd as jest.Mock).mockResolvedValue(1);
            const testMessage = getRandomString(1500);
            const received = await testClassService.sendMessage(defaultContext, testMessage)
            expect(
                received?.message.length
            ).toBeLessThan(1030);
        });

        it("should resolve with trimmed messages", async () => {
            // Setup mock implementations
            (fakeRedisCluster.xadd as jest.Mock).mockResolvedValue(1);
            const received = await testClassService.sendMessage(defaultContext, defaultMessage)
            expect(
                received?.message
            ).toEqual(defaultMessage);
        });

        it("should resolve to undefined when client.xadd resolves to a falsy value", async () => {

            // Setup mock implementations
            (fakeRedisCluster.xadd as jest.Mock).mockResolvedValue(undefined);
            (fakeRedisCluster.hgetall as jest.Mock).mockResolvedValue({});

            await expect(
                testClassService.sendMessage(defaultContext, defaultMessage)
            ).resolves.toBeUndefined();
        });

    });

    describe("endClass", () => {
        const testClassService = new ClassService(fakeRedisCluster);
        const defaultContext = {
            authorizationToken: {
                roomid: "test-roomid-string",
                teacher: false,
            },
            sessionId: "test-sessionid",
        } as unknown as Context;

        it("should return false when someone who is not teacher try to end class", async () => {
            const received = await testClassService.endClass(defaultContext);
            expect(received).toBeFalsy();
        })

    });

    describe("leaveRoom", () => {
        const testClassService = new ClassService(fakeRedisCluster);
        it("should return false when sessionId is falsy", async () => {
            const defaultContext = {
                authorizationToken: {
                    roomid: "test-roomid-string",
                    teacher: false,
                }
            } as unknown as Context;
            const received = await testClassService.endClass(defaultContext);
            expect(received).toBeFalsy();
        })

        it("should return false when roomId is falsy", async () => {
            const defaultContext = {
                authorizationToken: {
                    teacher: false,
                },
                sessionId: "test-sessionId"
            } as unknown as Context;
            const received = await testClassService.endClass(defaultContext);
            expect(received).toBeFalsy();
        })

    });

    describe("joinRoom", () => {
        const testClassService = new ClassService(fakeRedisCluster);
        it("should reject when websocket is falsy", async () => {
            const defaultContext = {
                authorizationToken: {
                    roomid: "test-roomid-string",
                    teacher: false,
                },
                sessionId: "test-sessionid",
            } as unknown as Context;
            const received = await testClassService.joinRoom(defaultContext);
            expect(received).toBeInstanceOf(Object);
        });

        it("should reject when sessionId is falsy", async () => {
            const defaultContext = {
                authorizationToken: {
                    roomid: "test-roomid-string",
                    teacher: false,
                },
                websocket: {}
            } as unknown as Context;
            const received = await testClassService.joinRoom(defaultContext);
            expect(received).toBeInstanceOf(Object);
        });

    });
});
