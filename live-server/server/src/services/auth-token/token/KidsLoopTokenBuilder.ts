import { KidsLoopTokenData, KidsLoopToken } from './KidsLoopToken'
import { UserInformation } from '../user-info/UserInformation'
import { RoomInformation } from '../room-info/RoomInformation'

export class KidsLoopTokenBuilder {
    private data : KidsLoopTokenData = {
      valid: false,
      expired: true,
      subject: '',
      audience: '',
      user: undefined,
      room: undefined
    }

    constructor (token?: KidsLoopToken) {
      if (!token) { return }
      this.data = token.toData()
    }

    withValid (valid: boolean) : KidsLoopTokenBuilder {
      this.data.valid = valid
      return this
    }

    withExpired (expired: boolean) : KidsLoopTokenBuilder {
      this.data.expired = expired
      return this
    }

    withSubject (subject: string) : KidsLoopTokenBuilder {
      this.data.subject = subject
      return this
    }

    withAudience (audience: string) : KidsLoopTokenBuilder {
      this.data.audience = audience
      return this
    }

    withUser (user: UserInformation) : KidsLoopTokenBuilder {
      this.data.user = user
      return this
    }

    withRoom (room: RoomInformation) : KidsLoopTokenBuilder {
      this.data.room = room
      return this
    }

    build () : KidsLoopToken {
      return KidsLoopToken.fromData(this.data)
    }
}
