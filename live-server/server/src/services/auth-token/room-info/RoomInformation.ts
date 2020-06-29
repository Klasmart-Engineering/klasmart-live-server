import { RoomInformationBuilder } from "./RoomInformationBuilder"

export interface RoomInformationData {
    roomId: string
}

export class RoomInformation {
    readonly roomId: string

    private constructor(roomId: string) {
        this.roomId = roomId
    }

    toData () : RoomInformationData {
        return {
            roomId: this.roomId
        }
    }

    static fromData (data : RoomInformationData) : RoomInformation {
        return new RoomInformation(data.roomId)
    }

    static builder (roomInformation?: RoomInformation) : RoomInformationBuilder {
        return new RoomInformationBuilder(roomInformation)
    }
}