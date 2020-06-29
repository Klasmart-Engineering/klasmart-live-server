import { UserInformationBuilder } from './UserInformationBuilder'

export interface UserInformationData {
    id: string
    name: string
    isTeacher: boolean
    organization: string | undefined
}

export class UserInformation {
    readonly id : string
    readonly name: string
    readonly isTeacher: boolean
    readonly organization: string | undefined

    private constructor (userInformationData: UserInformationData) {
        this.id = userInformationData.id
        this.name = userInformationData.name
        this.isTeacher = userInformationData.isTeacher
        this.organization = userInformationData.organization
    }

    toData () : UserInformationData {
        return {
            id: this.id,
            name: this.name,
            isTeacher: this.isTeacher,
            organization: this.organization
        }
    }

    static fromData (userInformationData: UserInformationData) : UserInformation {
        return new UserInformation(userInformationData)
    }

    static builder (userInformation?: UserInformation) : UserInformationBuilder {
        return new UserInformationBuilder(userInformation)
    }
}
