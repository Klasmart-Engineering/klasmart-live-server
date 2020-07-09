import { StaticKeyProvider } from "./StaticKeyProvider";
import { VerificationCredentials } from "./IKeyProvider";

export class StaticKeyProviderBuilder {
    credentials: VerificationCredentials[] = []

    withCredentials (credentials: VerificationCredentials[]) : StaticKeyProviderBuilder {
        this.credentials = credentials;
        return this;
    }

    build () : StaticKeyProvider {
        return new StaticKeyProvider(this.credentials);
    }
}