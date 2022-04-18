import {Pipeline} from "../../pipeline";
import {RedisKeys} from "../../redisKeys";
import {AttendanceService} from "../attendance/AttendanceService";
import {Base} from "../base";
import Redis from "ioredis";
import { ClassType } from "../../types";

export class SchedulerService extends Base {
    private attendance: AttendanceService;
    constructor(readonly client: Redis.Cluster | Redis.Redis) {
        super(client);
        this.attendance = new AttendanceService(client);
        setInterval(() => {
            this.checkSchedules();
        }, 60*1000);
    }

    public async addSchedule(roomId: string) {
        const roomContext = await this.getRoomContext(roomId);
        if (roomContext.classType === ClassType.STUDY) return;
        const tempStorageKeys = RedisKeys.tempStorageKeys();
        const tempStorageKey = RedisKeys.tempStorageKey(roomId);
        const tempStorageData = await this.client.get(tempStorageKey);
        if (!tempStorageData) {
            // send after n hour
            const time = new Date(roomContext.endAt*1000);
            if ( time > new Date()) {
                time.setSeconds(time.getSeconds() + Number(process.env.ASSESSMENT_GENERATE_TIME || 300));
                await this.client.set(tempStorageKey, time.getTime());
                await this.client.sadd(tempStorageKeys, roomId);
            }
        }
    }

    private async checkSchedules() {
        const isTepmStorageLocked = RedisKeys.isTepmStorageLocked();
        const isLocked = await this.client.set(isTepmStorageLocked, "true", "NX");
        if (isLocked) {
            const tempStorageKeys = RedisKeys.tempStorageKeys();
            const pipeline = new Pipeline(this.client);
            let tempStorageSearchCursor = "0";
            do {
                const [newCursor, keys] = await this.client.sscan(tempStorageKeys, tempStorageSearchCursor);

                for (const roomId of keys) {
                    const tempSingleKey = RedisKeys.tempStorageKey(roomId);
                    const tempSingleData = await this.client.get(tempSingleKey);
                    const currentTime = new Date();
                    const diffInSeconds = Number(tempSingleData) - Math.floor(currentTime.getTime());
                    if (diffInSeconds <= 0) {
                        // trigger assessment then delete data from redis
                        await this.trigger(roomId);
                        await pipeline.del(tempSingleKey);
                        await pipeline.srem(tempStorageKeys, roomId);
                    }
                }
                tempStorageSearchCursor = newCursor;
            } while (tempStorageSearchCursor !== "0");

            await pipeline.exec();
        }

        await this.client.del(isTepmStorageLocked);
    }

    private async trigger(roomId: string) {
        await this.attendance.send(roomId);
    }
}
