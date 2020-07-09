import { UserInformation, UserInformationData } from './UserInformation'

export class UserInformationBuilder {
    data: UserInformationData = {
        id: '',
        name: '',
        isTeacher: false,
        organization: undefined
    }

    constructor (userInformation?: UserInformation) {
        if (userInformation) { this.data = userInformation.toData() }
    }

    withId (id: string): UserInformationBuilder {
        this.data.id = id
        return this
    }

    withName (name: string): UserInformationBuilder {
        this.data.name = name
        return this
    }

    withIsTeacher (isTeacher: boolean): UserInformationBuilder {
        this.data.isTeacher = isTeacher
        return this
    }

    withOrganization (organization: string | undefined): UserInformationBuilder {
        this.data.organization = organization
        return this
    }

    build (): UserInformation {
        return UserInformation.fromData(this.data)
    }
}
