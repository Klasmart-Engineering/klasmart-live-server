import { IDecodedToken } from './token/IDecodedToken'

export interface IAuthenticationTokenDecoder {
    decodeToken (token: string) : Promise<IDecodedToken>
}
