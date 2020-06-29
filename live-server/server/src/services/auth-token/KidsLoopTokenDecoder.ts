import { IAuthenticationTokenDecoder } from './IAuthenticationTokenDecoder'
import { IDecodedToken } from './token/IDecodedToken'
import { IKeyProvider } from './key-provider/IKeyProvider'
import jwt from 'jsonwebtoken'
import { KidsLoopToken } from './token/KidsLoopToken'
import { UserInformation } from './user-info/UserInformation'
import { RoomInformation } from './room-info/RoomInformation'

interface IJsonWebTokenPayload {
    // NOTE: JWT standard fields
    sub: string
    iss: string
    aud: string
    exp: number
    nbf: number
    iat: number

    // KidsLoop fields
    name: string
    roomid: string
    userid: string
    teacher: boolean
    org: string
}

export class KidsLoopTokenDecoder implements IAuthenticationTokenDecoder {
    private readonly keyProvider: IKeyProvider

    constructor (keyProvider: IKeyProvider) {
        this.keyProvider = keyProvider
    }

    decodeToken (token: string) : Promise<IDecodedToken> {
        const payload = jwt.decode(token) as IJsonWebTokenPayload

        if (!payload) {
            return Promise.reject(new Error('Malformed token data.'))
        }

        const userInfo = UserInformation.builder()
            .withId(payload.userid)
            .withName(payload.name)
            .withIsTeacher(payload.teacher)
            .withOrganization(payload.org)
            .build()

        const roomInfo = RoomInformation.builder()
            .withRoomId(payload.roomid)
            .build()

        const issuer = payload.iss
        const cred = this.keyProvider.getCredentials(issuer)

        if (cred === undefined) {
            const decodedToken =
                    KidsLoopToken.builder()
                        .withExpired(false)
                        .withValid(false)
                        .withSubject(payload.sub)
                        .withAudience(payload.aud)
                        .withUser(userInfo)
                        .withRoom(roomInfo)
                        .build()

            return Promise.resolve(decodedToken)
        }
        
        const verifyOperation = new Promise<IDecodedToken>((resolve) => {
            // NOTE: A function could be passed instead of the cert value. This function
            // would be invoked by the asynchronous verify method to retrieve the key.
            jwt.verify(token, cred.certificate, {
                algorithms: cred.algorithms,
                issuer: cred.issuer
            }, (err, _verifiedPayload) => {
                const expired = (err instanceof jwt.NotBeforeError || err instanceof jwt.TokenExpiredError)
                const invalid = (err !== null)

                const decodedToken =
                    KidsLoopToken.builder()
                        .withExpired(expired)
                        .withValid(!invalid)
                        .withSubject(payload.sub)
                        .withAudience(payload.aud)
                        .withUser(userInfo)
                        .withRoom(roomInfo)
                        .build()

                resolve(decodedToken)
            })
        })

        return verifyOperation
    }
}
