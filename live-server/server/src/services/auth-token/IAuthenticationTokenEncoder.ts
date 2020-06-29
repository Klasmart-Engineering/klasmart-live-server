
export interface EncodeTokenOptions {
    issuer?: string
    notBefore?: string | number
    expiresIn?: string | number
    subject?: string
    audience?: string
}

export interface IAuthenticationTokenEncoder {
    encodeToken(options: EncodeTokenOptions, payload: string | object | Buffer) : string
}