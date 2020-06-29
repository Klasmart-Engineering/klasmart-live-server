import { IDecodedToken } from './IDecodedToken'
import { UserInformation } from '../user-info/UserInformation'
import { KidsLoopTokenBuilder } from './KidsLoopTokenBuilder'
import { RoomInformation } from '../room-info/RoomInformation'

export interface KidsLoopTokenData {
    valid: boolean
    expired: boolean
    audience: string
    subject: string
    user: UserInformation | undefined
    room: RoomInformation | undefined
}

export class KidsLoopToken implements IDecodedToken {
    readonly valid: boolean
    readonly expired: boolean

    readonly audience: string
    readonly subject: string

    readonly user: UserInformation | undefined
    readonly room: RoomInformation | undefined

    private constructor (data: KidsLoopTokenData) {
        this.valid = data.valid
        this.expired = data.expired
        this.user = data.user
        this.audience = data.audience
        this.subject = data.subject
        this.room = data.room
    }

    isValid () : boolean {
        return this.valid
    }

    isExpired () : boolean {
        return this.expired
    }

    getSubject () : string {
        return this.subject
    }

    getAudience () : string {
        return this.audience
    }

    userInformation () : UserInformation | undefined {
        return this.user
    }

    roomInformation () : RoomInformation | undefined {
        return this.room
    }

    toData () : KidsLoopTokenData {
        return {
            valid: this.valid,
            expired: this.expired,
            user: this.user,
            audience: this.audience,
            subject: this.subject,
            room: this.room
        }
    }

    static fromData (data: KidsLoopTokenData) : KidsLoopToken {
        return new KidsLoopToken(data)
    }

    static builder (token?: KidsLoopToken) : KidsLoopTokenBuilder {
        return new KidsLoopTokenBuilder(token)
    }
}
