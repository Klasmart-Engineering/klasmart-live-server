import { Material } from "./Material";
import { RoomInformationBuilder } from "./RoomInformationBuilder";

export interface RoomInformationData {
    roomId: string
    materials: Material[]
}

export class RoomInformation {
    readonly roomId: string
    readonly materials: Material[]

    private constructor(roomId: string, materials: Material[]) {
        this.roomId = roomId;
        this.materials = materials;
    }

    toData () : RoomInformationData {
        return {
            roomId: this.roomId,
            materials: this.materials
        };
    }

    static fromData (data : RoomInformationData) : RoomInformation {
        return new RoomInformation(data.roomId, data.materials);
    }

    static builder (roomInformation?: RoomInformation) : RoomInformationBuilder {
        return new RoomInformationBuilder(roomInformation);
    }
}