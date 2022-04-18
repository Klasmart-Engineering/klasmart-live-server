import {SecretsManager} from "aws-sdk";
import {readFileSync} from "fs";
import {
    Secret,
    sign,
    SignOptions,
} from "jsonwebtoken";
import {AttendanceRequestType, StudentReportRequestType} from "./types";

export async function generateToken(requestBody: AttendanceRequestType | StudentReportRequestType) {
    const {secretOrPrivateKey, options} = await jwtConfig();

    return new Promise<string>((resolve, reject) => {
        sign(requestBody, secretOrPrivateKey, options, (err, token) => {
            if (err) {
                reject(err);
            } else if (token) {
                resolve(token);
            } else {
                reject(new Error("Signing attendance token failed without explicit error"));
            }
        });
    });
}

let config: { options: SignOptions; secretOrPrivateKey: Secret; secretOrPublicKey: Secret } | undefined;
async function jwtConfig() {
    if (config) {
        return config;
    }
    config = await jwtInit();
    return config;
}
const issuer = process.env.JWT_ISSUER;
async function jwtInit(): Promise<{ options: SignOptions; secretOrPrivateKey: Secret; secretOrPublicKey: Secret }> {
    const awsSecretName = process.env.AWS_SECRET_NAME;
    if (awsSecretName) {
        if (process.env.JWT_SECRET) {
            throw new Error("JWT configuration error - both AWS_SECRET_NAME and JWT_SECRET enviroment variables were specified. Please choose one or the other.");
        }
        if (process.env.JWT_PRIVATE_KEY || process.env.JWT_PRIVATE_KEY_FILENAME) {
            throw new Error("JWT configuration error - both AWS_SECRET_NAME and (JWT_PRIVATE_KEY || JWT_PRIVATE_KEY_FILENAME) enviroment variables were specified. Please choose one or the other.");
        }
        if (process.env.JWT_PUBLIC_KEY || process.env.JWT_PUBLIC_KEY_FILENAME) {
            throw new Error("JWT configuration error - both AWS_SECRET_NAME and (JWT_PUBLIC_KEY || JWT_PUBLIC_KEY_FILENAME) enviroment variables were specified. Please choose one or the other.");
        }
        if (process.env.JWT_ALGORITHM) {
            throw new Error("JWT configuration error - both AWS_SECRET_NAME and JWT_ALGORITHM enviroment variables were specified. Please choose one or the other.");
        }

        const keys = await retrieveJWTKeys(awsSecretName);
        const passphrase = keys.passphrase || process.env.JWT_PRIVATE_KEY_PASSPHRASE;
        return {
            options: {
                algorithm: keys.algorithm,
                issuer,
            },
            secretOrPrivateKey: passphrase ?
                {
                    key: keys.privateKey,
                    passphrase,
                } :
                keys.privateKey,
            secretOrPublicKey: keys.publicKey,
        };
    }
    const algorithm = process.env.JWT_ALGORITHM;

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
            options: {
                algorithm,
                issuer,
            },
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
        const passphrase = process.env.JWT_PRIVATE_KEY_PASSPHRASE;
        const privateKey = process.env.JWT_PRIVATE_KEY_FILENAME ? readFileSync(process.env.JWT_PRIVATE_KEY_FILENAME) : process.env.JWT_PRIVATE_KEY;
        if (!privateKey) {
            throw new Error("JWT configuration error - please use either JWT_PRIVATE_KEY or JWT_PRIVATE_KEY_FILENAME to specify private key");
        }
        const secretOrPrivateKey = passphrase ? {
            key: privateKey,
            passphrase,
        } : privateKey;
        const secretOrPublicKey = process.env.JWT_PUBLIC_KEY_FILENAME ? readFileSync(process.env.JWT_PUBLIC_KEY_FILENAME) : process.env.JWT_PUBLIC_KEY;
        if (!secretOrPublicKey) {
            throw new Error("JWT configuration error - please use either JWT_PUBLIC_KEY_FILENAME or JWT_PUBLIC_KEY to specify public key");
        }
        return {
            options: {
                algorithm,
                issuer,
            },
            secretOrPrivateKey,
            secretOrPublicKey,
        };
    }
    default:
        throw new Error("JWT Token not configured");
    }
}

const client = new SecretsManager();
export async function retrieveJWTKeys(secretName: string) {
    try {
        const response = await client.getSecretValue({
            SecretId: secretName,
        }).promise();
        const secret = response.SecretString;
        if (!secret) throw new Error("The returned secret is undefined.");
        const keys = JSON.parse(secret);
        return {
            algorithm: keys["ALGORITHM"].replace(/\\n/gm, "\n"),
            privateKey: keys["PRIVATE_KEY"].replace(/\\n/gm, "\n"),
            publicKey: keys["PUBLIC_KEY"].replace(/\\n/gm, "\n"),
            passphrase: keys["PASSPHRASE"],
        };
    } catch (err: any) {
        if (err.code ==="DecryptionFailureException") {
            // Secrets Manager can't decrypt the protected secret text using the provided KMS key.
            // Deal with the exception here, and/or rethrow at your discretion.
            throw err;
        } else if (err.code ==="InternalServiceErrorException") {
            // An error occurred on the server side.
            // Deal with the exception here, and/or rethrow at your discretion.
            throw err;
        } else if (err.code === "InvalidParameterException") {
            // You provided an invalid value for a parameter.
            // Deal with the exception here, and/or rethrow at your discretion.
            throw err;
        } else if (err.code === "InvalidRequestException") {
            // You provided a parameter value that is not valid for the current state of the resource.
            // Deal with the exception here, and/or rethrow at your discretion.
            throw err;
        } else if (err.code === "ResourceNotFoundException") {
            // We can't find the resource that you asked for.
            // Deal with the exception here, and/or rethrow at your discretion.
            throw err;
        } else {
            throw err;
        }
    }
}
