import { UserInformationData, UserInformation } from '../../../src/services/auth-token/user-info/UserInformation'
import { assert } from 'chai'

describe('UserInformation', () => {
    it('toData_AssignsAllFields', () => {
        const expectedUserInformationData: UserInformationData = {
            id: 'user-id',
            name: 'user-name',
            isTeacher: true,
            organization: 'org-id'
        }

        const userInformation = UserInformation.fromData(expectedUserInformationData)
        
        assert.deepEqual(userInformation.toData(), expectedUserInformationData, 'User information data doesn\'t match.')
    })
})
