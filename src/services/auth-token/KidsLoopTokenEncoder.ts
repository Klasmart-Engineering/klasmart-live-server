import { sign, SignOptions, Algorithm } from "jsonwebtoken";
import { EncodeTokenOptions, IAuthenticationTokenEncoder } from "./IAuthenticationTokenEncoder";

export interface KidsLoopTokenPayload {
    name: string
    roomid: string
    userid: string
    teacher: boolean
    org: string
}

export class KidsLoopTokenEncoder implements IAuthenticationTokenEncoder {
    readonly algorithm: Algorithm
    readonly credentials: string | Buffer

    constructor (credentials: string | Buffer, algorithm: Algorithm) {
        this.credentials = credentials;
        this.algorithm = algorithm;
    }

    encodeToken (options: EncodeTokenOptions, payload: string | object | Buffer): string {
        const signOptions : SignOptions = {
            algorithm: this.algorithm
        };

        if (options.issuer) {
            signOptions.issuer = options.issuer;
        }

        if (options.subject) {
            signOptions.subject = options.subject;
        }

        if (options.audience) {
            signOptions.audience = options.audience;
        }

        if (options.expiresIn) {
            signOptions.expiresIn = options.expiresIn;
        }

        if (options.notBefore) {
            signOptions.notBefore = options.notBefore;
        }

        return sign(payload, this.credentials, signOptions);
    }
}
