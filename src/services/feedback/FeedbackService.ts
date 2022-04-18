import {Base} from "../base";
import {Context} from "../../types";
import Redis from "ioredis";
import request from "graphql-request";
import {SAVE_FEEDBACK_MUTATION} from "../../graphql";

export class FeedbackService extends Base {
    constructor(readonly client: Redis.Cluster | Redis.Redis) {
        super(client);
    }

    public async rewardTrophy(context: Context, user: string, kind: string): Promise<boolean> {
        const roomId = context.authorizationToken.roomid;
        const { sessionId } = context;
        if (!sessionId) {
            throw new Error("Can't reward trophy without knowing the sessionId it was from");
        }
        await this.notifyRoom(roomId, {
            trophy: {
                from: sessionId,
                user,
                kind,
            },
        });
        return true;
    }

    public async saveFeedback(context: Context, stars: number, feedbackType: string, comment: string, quickFeedback: {type: string; stars: number}[]): Promise<boolean> {
        const url = process.env.ATTENDANCE_SERVICE_ENDPOINT;

        if (!context.authorizationToken || !context.sessionId || !url) {
            return true;
        }
        const variables = {
            roomId: context.authorizationToken.roomid,
            userId: context.authorizationToken.userid,
            sessionId: context.sessionId,
            stars: stars,
            comment: comment,
            feedbackType: feedbackType,
            quickFeedback: quickFeedback,
        };
        await request(url, SAVE_FEEDBACK_MUTATION, variables).then((data) => {
            const feedback = data.saveFeedback;
            console.log("\nsaved feedback: ", feedback);
        }).catch((e) => {
            console.log("could not save feedback: ", e);
        });

        return true;
    }
}
