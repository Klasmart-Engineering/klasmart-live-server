import {
    sign,
    SignOptions,
} from "jsonwebtoken";
import { ClassType } from "../../src/types";
import { getUniqueId, getEpochTime } from "./functions";

function generateToken(requestBody: any, expire: number) {
    const secretOrPrivateKey = "iXtZx1D5AqEB0B9pfn+hRQ==";
    const options: SignOptions = {
        algorithm: "HS256",
        issuer:"calmid-debug",
        expiresIn: expire | 3600,
    };

    return sign(requestBody, secretOrPrivateKey, options);
}

function generateUserData(name: string, end_at: number, classType: string, isTeacher: boolean) {
    const data: any = {
        "name": name,
        "schedule_id": getUniqueId(),
        "is_review": false,
        "user_id": getUniqueId(),
        "type": "live",
        "teacher": isTeacher,
        "roomid": getUniqueId(),
        "materials": [
            {
                "id": "60b7566558b0e68ab76bac76",
                "name": "Find Words",
                "url": "/h5p/play/60b756632fe67200132b7627",
                "__typename": "Iframe"
            }
        ],
        "classtype": classType,
        "org_id": getUniqueId(),
        "start_at": getEpochTime(1),
        "end_at": end_at
    };
    return data;
}


export  function getToken (classType: ClassType, isTeacher: boolean, isTokenExpired: boolean, isClassEnded: boolean) {
    const name = isTeacher? "Teacher" : "Student";
    const end_at = isClassEnded ? getEpochTime(1) : getEpochTime(3600);
    const expire = isTokenExpired ? 1 : 3600;
    const data = generateUserData(name, end_at,  classType, isTeacher);
    const token = generateToken(data, expire);
    return token;
}