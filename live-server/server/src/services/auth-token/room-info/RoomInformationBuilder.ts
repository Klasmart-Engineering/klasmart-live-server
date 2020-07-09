import { RoomInformation, RoomInformationData } from "./RoomInformation";

export class RoomInformationBuilder {
    private data: RoomInformationData = {
        roomId: ""
    }

    constructor (roomInformation?: RoomInformation) {
        if (roomInformation !== undefined) {
            this.data = roomInformation.toData();
        }
    }

    withRoomId (roomId: string) : RoomInformationBuilder {
        this.data.roomId = roomId;
        return this;
    }

    build () : RoomInformation {
        return RoomInformation.fromData(this.data);
    }
}