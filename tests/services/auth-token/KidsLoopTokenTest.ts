import { KidsLoopToken, KidsLoopTokenData } from "../../../src/services/auth-token/token/KidsLoopToken"
import { assert } from "chai"
import { RoomInformation } from "../../../src/services/auth-token/room-info/RoomInformation"
import { assertAbstractType, assertType } from "graphql"
import { RoomInformationBuilder } from "../../../src/services/auth-token/room-info/RoomInformationBuilder"
import { UserInformationBuilder } from "../../../src/services/auth-token/user-info/UserInformationBuilder"

describe('KidsLoopToken', () => {
    it('isValid_ReturnsExpectedValue', () => {
        const sut = KidsLoopToken.builder()
            .withValid(true)
            .build()

        assert.equal(sut.isValid(), sut.valid)
    })
    it('isExpired_ReturnsExpectedValue', () => {
        const sut = KidsLoopToken.builder()
            .withValid(true)
            .build()

        assert.equal(sut.isExpired(), sut.expired)
    })
    it('getSubject_ReturnsExpectedValue', () => {
        const sut = KidsLoopToken.builder()
            .withValid(true)
            .build()

        assert.equal(sut.getSubject(), sut.subject)
    })
    it('getAudience_ReturnsExpectedValue', () => {
        const sut = KidsLoopToken.builder()
            .withAudience('audience-value')
            .build()

        assert.equal(sut.getAudience(), sut.audience)
    })
    it('userInformation_ReturnsExpectedValue', () => {
        const expectedUser = new UserInformationBuilder()
            .withId('user-id')
            .withName('user-name')
            .withIsTeacher(true)
            .withOrganization('org-id')
            .build()

        const sut = KidsLoopToken.builder()
            .withUser(expectedUser)
            .build()

        assert.equal(sut.userInformation(), expectedUser)
    })
    it('roomInformation_ReturnsExpectedValue', () => {
        const expectedRoom = new RoomInformationBuilder()
            .withRoomId('room-id')
            .build()

        const sut = KidsLoopToken.builder()
            .withRoom(expectedRoom)
            .build()

        assert.equal(sut.roomInformation(), expectedRoom)
    })
    it('toData_ReturnsExpectedValue', () => {
        const expectedUser = new UserInformationBuilder()
            .withId('user-id')
            .withName('user-name')
            .withIsTeacher(true)
            .withOrganization('org-id')
            .build()

        const expectedRoom = new RoomInformationBuilder()
            .withRoomId('room-id')
            .build()

        const expectedToken: KidsLoopTokenData = {
            valid: true,
            expired: true,
            audience: 'audience-value',
            subject: 'subject-value',
            user: expectedUser,
            room: expectedRoom
        }

        const token = KidsLoopToken.fromData(expectedToken)
        assert.deepEqual(token.toData(), expectedToken, 'Token data doesn\'t match.')
    })
})