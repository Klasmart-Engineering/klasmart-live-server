
import { describe, it } from 'mocha'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { spy, when } from 'ts-mockito'
import { KidsLoopTokenDecoder } from '../../../src/services/auth-token/KidsLoopTokenDecoder'
import { DebugKeyProvider, PrivateKey, ValidAlgorithms, ValidIssuer, PublicKey } from '../../../src/services/auth-token/key-provider/DebugKeyProvider'
import { KidsLoopTokenEncoder } from '../../../src/services/auth-token/KidsLoopTokenEncoder'
import { EncodeTokenOptions } from '../../../src/services/auth-token/IAuthenticationTokenEncoder'
import { VerificationCredentials } from '../../../src/services/auth-token/key-provider/IKeyProvider'
import { UserInformation } from '../../../src/services/auth-token/user-info/UserInformation'
import { RoomInformation } from '../../../src/services/auth-token/room-info/RoomInformation'


const assert = chai.assert

chai.use(chaiAsPromised)

describe('KidsLoopTokenDecoder', () => {
    it(('decodeToken_WithMalformed_Reject'), () => {
        const keyProvider = new DebugKeyProvider()
        const sut = new KidsLoopTokenDecoder(keyProvider)

        const decodeOperation = sut.decodeToken('some-malformed-token-data')
        assert.isRejected(decodeOperation, 'Malformed token data.', 'Malformed token data wasn\'t rejected.')
    })
    it('decodeToken_WithEmpty_Reject', () => {
        const keyProvider = new DebugKeyProvider()
        const sut = new KidsLoopTokenDecoder(keyProvider)

        const decodeOperation = sut.decodeToken('')
        assert.isRejected(decodeOperation, 'Malformed token data.', 'Empty token data wasn\'t rejected.')
    })
    it('decodeToken_WithEmptyPayload_Resolve', () => {
        const encoder = new KidsLoopTokenEncoder(PrivateKey, ValidAlgorithms[0])

        const payload = {}
        const options : EncodeTokenOptions = {
            issuer: 'calmid',
            expiresIn: '5m',
            subject: 'unit-test-subject',
            audience: 'unit-test-audience'
        }
        const token = encoder.encodeToken(options, payload)

        const keyProvider = new DebugKeyProvider()
        const sut = new KidsLoopTokenDecoder(keyProvider)

        const decodeOperation = sut.decodeToken(token)
        assert.isFulfilled(decodeOperation, 'Decode should be successful.')
    })
    it('decodeToken_WithExpiredToken_Resolve_Expired', () => {
        const encoder = new KidsLoopTokenEncoder(PrivateKey, ValidAlgorithms[0])

        const payload = {}
        const options : EncodeTokenOptions = {
            issuer: 'calmid',
            expiresIn: '-5m',
            subject: 'unit-test-subject',
            audience: 'unit-test-audience'
        }
        const token = encoder.encodeToken(options, payload)

        const keyProvider = new DebugKeyProvider()
        const sut = new KidsLoopTokenDecoder(keyProvider)

        const decodeOperation = sut.decodeToken(token)
        assert.eventually.propertyVal(decodeOperation, 'valid', false)
        assert.eventually.propertyVal(decodeOperation, 'expired', true)
    })
    it('decodeToken_WithNotBefore_Resolve_Expired', () => {
        const encoder = new KidsLoopTokenEncoder(PrivateKey, ValidAlgorithms[0])

        const payload = {}
        const options : EncodeTokenOptions = {
            issuer: 'calmid',
            expiresIn: '5m',
            notBefore: '5m',
            subject: 'unit-test-subject',
            audience: 'unit-test-audience'
        }
        const token = encoder.encodeToken(options, payload)

        const keyProvider = new DebugKeyProvider()
        const sut = new KidsLoopTokenDecoder(keyProvider)

        const decodeOperation = sut.decodeToken(token)
        assert.eventually.propertyVal(decodeOperation, 'valid', false)
        assert.eventually.propertyVal(decodeOperation, 'expired', true)
    })
    it('decodeToken_WithInvalidIssuer_Resolve_Invalid', () => {
        const encoder = new KidsLoopTokenEncoder(PrivateKey, ValidAlgorithms[0])

        const payload = {}
        const options : EncodeTokenOptions = {
            issuer: 'calmid-invalid-issuer',
            expiresIn: '5m',
            subject: 'unit-test-subject',
            audience: 'unit-test-audience'
        }
        const token = encoder.encodeToken(options, payload)

        const keyProvider = new DebugKeyProvider()
        const sut = new KidsLoopTokenDecoder(keyProvider)

        const decodeOperation = sut.decodeToken(token)
        assert.eventually.propertyVal(decodeOperation, 'valid', false)
        assert.eventually.propertyVal(decodeOperation, 'expired', false)
    })
    it('decodeToken_WithInvalidAlgorithm_Resolve_Invalid', () => {
        const encoder = new KidsLoopTokenEncoder(PrivateKey, ValidAlgorithms[0])

        const payload = {}
        const options : EncodeTokenOptions = {
            issuer: 'calmid',
            expiresIn: '5m',
            subject: 'unit-test-subject',
            audience: 'unit-test-audience'
        }
        const token = encoder.encodeToken(options, payload)

        const keyProvider = new DebugKeyProvider()
        const keyProviderSpy = spy(keyProvider)

        const mockCreds : VerificationCredentials = {
            id: 'calmid',
            issuer: ValidIssuer,
            algorithms: ['PS384', 'RS384'],
            certificate: PublicKey
        }
        when(keyProviderSpy.getCredentials('calmid')).thenReturn(mockCreds)

        const sut = new KidsLoopTokenDecoder(keyProvider)

        const decodeOperation = sut.decodeToken(token)
        assert.eventually.propertyVal(decodeOperation, 'valid', false)
        assert.eventually.propertyVal(decodeOperation, 'expired', false)
    })
    it('decodeToken_WithUndefinedCredentials_Resolve_Invalid', () => {
        const encoder = new KidsLoopTokenEncoder(PrivateKey, ValidAlgorithms[0])

        const payload = {}
        const options : EncodeTokenOptions = {
            issuer: 'calmid',
            expiresIn: '5m',
            subject: 'unit-test-subject',
            audience: 'unit-test-audience'
        }
        const token = encoder.encodeToken(options, payload)

        const keyProvider = new DebugKeyProvider()
        const keyProviderSpy = spy(keyProvider)
        
        when(keyProviderSpy.getCredentials('calmid')).thenReturn(undefined)

        const sut = new KidsLoopTokenDecoder(keyProvider)

        const decodeOperation = sut.decodeToken(token)
        assert.eventually.propertyVal(decodeOperation, 'valid', false)
        assert.eventually.propertyVal(decodeOperation, 'expired', false)
    })
    it('decodeToken_WithUserPayload_EqualsInput', () => {
        const encoder = new KidsLoopTokenEncoder(PrivateKey, ValidAlgorithms[0])

        const payload = {
            name: 'My Name',
            userid: 'user-id-01',
            teacher: true,
            org: 'org-id-01'
        }
        const options : EncodeTokenOptions = {
            issuer: 'calmid',
            expiresIn: '5m',
            subject: 'unit-test-subject',
            audience: 'unit-test-audience'
        }
        const token = encoder.encodeToken(options, payload)

        const keyProvider = new DebugKeyProvider()
        const sut = new KidsLoopTokenDecoder(keyProvider)

        const expectedUser = UserInformation.builder()
            .withId(payload.userid)
            .withName(payload.name)
            .withOrganization(payload.org)
            .withIsTeacher(payload.teacher)
            .build()

        const decodeOperation = sut.decodeToken(token)
        assert.eventually.deepPropertyVal(decodeOperation, 'user', expectedUser)
    })
    it('decodeToken_WithRoomPayload_EqualsInput', () => {
        const encoder = new KidsLoopTokenEncoder(PrivateKey, ValidAlgorithms[0])

        const payload = {
            roomid: 'room-id-01'
        }
        const options : EncodeTokenOptions = {
            issuer: 'calmid',
            expiresIn: '5m',
            subject: 'unit-test-subject',
            audience: 'unit-test-audience'
        }
        const token = encoder.encodeToken(options, payload)

        const keyProvider = new DebugKeyProvider()
        const sut = new KidsLoopTokenDecoder(keyProvider)

        const expectedRoom = RoomInformation.builder()
            .withRoomId(payload.roomid)
            .build()

        const decodeOperation = sut.decodeToken(token)
        assert.eventually.deepPropertyVal(decodeOperation, 'room', expectedRoom)
    })
})
