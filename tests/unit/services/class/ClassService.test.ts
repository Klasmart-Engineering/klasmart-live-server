import { ClassService } from "../../../../src/services/class/ClassService";
import { Cluster } from "ioredis";
import { RedisKeys } from "../../../../src/redisKeys";
import { Context } from "../../../../src/types";

describe("ClassService", () => {

    // Mock redis cluster
    const fakeRedisCluster = {
        expire: jest.fn(),
        xadd: jest.fn(),
        hgetall: jest.fn(),
    } as any as Cluster;

    const roomMessagesSpy = jest.spyOn(RedisKeys, "roomMessages");
    roomMessagesSpy.mockReturnValue({
        key: "test-key",
        ttl: 1
    });

    const defaultMessage = "default test message";
    const defaultContext = {
        authorizationToken: {
            roomid: "test-roomid-string",
        },
        sessionId: "test-sessionid",
    } as unknown as Context;


    describe("sendMessage", () => {
        const testClassService = new ClassService(fakeRedisCluster);


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

        it("should resolve to undefined when client.xadd resolves to a falsy value", async () => {

            // Setup mock implementations
            (fakeRedisCluster.xadd as jest.Mock).mockResolvedValue(undefined);
            (fakeRedisCluster.hgetall as jest.Mock).mockResolvedValue({});

            await expect(
                testClassService.sendMessage(defaultContext, defaultMessage)
            ).resolves.toBeUndefined();
        });

        it("should resolve with long messages truncated to a maximum length of 1024", async () => {

        });

        it("should resolve with trimmed messages", async () => {

        });

        it("should resolve with truncated messages trimmed", async () => {

        });

        it("should resolve to object when xadd returns truthy id", async () => {

        });
    });
});
