import { UserInformation } from "../user-info/UserInformation";
import { RoomInformation } from "../room-info/RoomInformation";

export interface IDecodedToken {
    isValid () : boolean
    isExpired () : boolean

    getSubject () : string
    getAudience () : string

    userInformation () : UserInformation | undefined
    roomInformation () : RoomInformation | undefined
}
