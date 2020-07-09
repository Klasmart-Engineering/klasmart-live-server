import { IKeyProvider, VerificationCredentials } from "./IKeyProvider";
import { Algorithm } from "jsonwebtoken";

export class StaticKeyProvider implements IKeyProvider {
    readonly credentials: VerificationCredentials[] = []

    constructor (credentials?: VerificationCredentials[]) {
        if (credentials !== undefined) {
            this.credentials = credentials;
        }
    }

    getCredentials (issuerId: string): VerificationCredentials | undefined {
        const cred = this.lookupCredentials(issuerId);
        return cred;
    }

    getValidIssuer (issuerId: string): string | string[] | undefined {
        const cred = this.lookupCredentials(issuerId);
        if (cred !== undefined) {
            return cred.issuer;
        }
        
        return undefined;
    }

    getValidAlgorithms (issuerId: string): Algorithm[] | undefined {
        const cred = this.lookupCredentials(issuerId);
        if (cred !== undefined) {
            return cred.algorithms;
        }

        return undefined;
    }

    getCertificateForIssuer (issuerId: string): string | Buffer | undefined {
        const cred = this.lookupCredentials(issuerId);
        if (cred !== undefined) {
            return cred.certificate;
        }

        return undefined;
    }

    private lookupCredentials (id: string) : VerificationCredentials | undefined {
        const matches = this.credentials.filter(x => x.id === id);

        if (matches.length > 0) {
            return matches[0];
        }

        return undefined;
    }
}
