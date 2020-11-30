import { sign, Secret, SignOptions } from "jsonwebtoken";
import { readFileSync } from "fs";

const issuer = process.env.JWT_ISSUER;
const config = jwtInit();

export function attendanceToken(room_id: string, attendance_ids: string[], class_start_time: number, class_end_time: number) {
    const class_length = class_end_time - class_start_time;
    const schedule_id = room_id;
    return new Promise<string>((resolve, reject) => {
        sign(
            {
                attendance_ids,
                class_end_time,
                class_length,
                schedule_id,          
            },
            config.secretOrPrivateKey,
            config.options,
            (err, token) => {
                if(err) { reject(err); }
                else if(token) { resolve(token); }
                else { reject(new Error("Signing attendance token failed without explicit error")); }
            }
        );
    });
}

function jwtInit(): { options: SignOptions, secretOrPrivateKey: Secret, secretOrPublicKey: Secret } {
    const algorithm = process.env.JWT_ALGORITHM;

    const options = {
        algorithm,
        issuer
    } as SignOptions;

    switch (algorithm) {
    case "HS256":
    case "HS384":
    case "HS512":
        if (process.env.JWT_PRIVATE_KEY || process.env.JWT_PRIVATE_KEY_FILENAME) {
            throw new Error(`JWT configuration error - can not use '${algorithm}' algorithm with private key, please set JWT_SECRET enviroment variable`);
        }
        if (!process.env.JWT_SECRET) {
            throw new Error(`JWT configuration error - '${algorithm}' algorithm requires secret, please set JWT_SECRET enviroment variable`);
        }
        return {
            options,
            secretOrPrivateKey: process.env.JWT_SECRET,
            secretOrPublicKey: process.env.JWT_SECRET,
        };
    case "RS256":
    case "RS384":
    case "RS512":
    case "ES256":
    case "ES384":
    case "ES512":
    case "PS256":
    case "PS384":
    case "PS512": {
        if (process.env.JWT_SECRET) {
            throw new Error(`JWT configuration error - can not use '${algorithm}' algorithm with jwt secret key, please set JWT_PRIVATE_KEY or JWT_PRIVATE_KEY_FILENAME enviroment variable`);
        }
        if (process.env.JWT_PRIVATE_KEY && process.env.JWT_PRIVATE_KEY_FILENAME) {
            throw new Error("JWT configuration error - please use either JWT_PRIVATE_KEY or JWT_PRIVATE_KEY_FILENAME not both");
        }
        if (process.env.JWT_PUBLIC_KEY_FILENAME && process.env.JWT_PUBLIC_KEY) {
            throw new Error("JWT configuration error - please use either JWT_PUBLIC_KEY_FILENAME or JWT_PUBLIC_KEY not both");
        }
        const privateKey = process.env.JWT_PRIVATE_KEY_FILENAME ? readFileSync(process.env.JWT_PRIVATE_KEY_FILENAME) : process.env.JWT_PRIVATE_KEY;
        if (!privateKey) {
            throw new Error("JWT configuration error - please use either JWT_PRIVATE_KEY or JWT_PRIVATE_KEY_FILENAME to specify private key");
        }
        const publicKey = process.env.JWT_PUBLIC_KEY_FILENAME ? readFileSync(process.env.JWT_PUBLIC_KEY_FILENAME) : process.env.JWT_PUBLIC_KEY;
        if (!publicKey) {
            throw new Error("JWT configuration error - please use either JWT_PUBLIC_KEY_FILENAME or JWT_PUBLIC_KEY to specify public key");
        }
        return {
            options,
            secretOrPrivateKey: process.env.JWT_PRIVATE_KEY_PASSPHRASE
                ? { key: privateKey, passphrase: process.env.JWT_PRIVATE_KEY_PASSPHRASE }
                : privateKey,
            secretOrPublicKey: publicKey,
        };
    }
    default:
        throw new Error("JWT Token not configured");
    }
}
