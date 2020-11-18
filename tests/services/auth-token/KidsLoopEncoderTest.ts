import { KidsLoopTokenEncoder } from '../../../src/services/auth-token/KidsLoopTokenEncoder'
import { PrivateKey, ValidAlgorithms } from '../../../src/services/auth-token/key-provider/DebugKeyProvider'
import { EncodeTokenOptions } from '../../../src/services/auth-token/IAuthenticationTokenEncoder'
import { assert } from 'chai'

describe('KidsLoopTokenEncoder', () => {
    it('encodeToken_WithEmptyOptions_Valid', () => {
        const sut = new KidsLoopTokenEncoder(PrivateKey, ValidAlgorithms[0])

        const options: EncodeTokenOptions = {}
        assert.isDefined(sut.encodeToken(options, {}))
    })
})
