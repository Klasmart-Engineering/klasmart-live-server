
import { Algorithm } from 'jsonwebtoken'

export interface VerificationCredentials {
    id: string
    issuer: string | string[]
    algorithms: Algorithm[]
    certificate: string | Buffer
}

export interface IKeyProvider {
    getCredentials(issuerId: string) : VerificationCredentials | undefined
    getValidIssuer(issuerId: string) : string | string[] | undefined
    getValidAlgorithms(issuerId: string) : Algorithm[] | undefined
    getCertificateForIssuer(issuerId: string) : string | Buffer | undefined
}
