import { RoomInformation, RoomInformationData } from "../../../src/services/auth-token/room-info/RoomInformation"
import { assert } from 'chai'
import { RoomInformationBuilder } from "../../../src/services/auth-token/room-info/RoomInformationBuilder"

describe('RoomInformation', () => {
    it('toData_AssignsAllFields', () => {
        const expectedRoomInformationData: RoomInformationData = {
            roomId: 'room-id'
        }

        const roomInformation = RoomInformation.fromData(expectedRoomInformationData)
        
        assert.deepEqual(roomInformation.toData(), expectedRoomInformationData, 'Room information data doesn\'t match.')
    })
    it('builder_AssignsAllFields', () => {
        const expectedRoomInformationData: RoomInformationData = {
            roomId: 'room-id'
        }

        const roomInformation = RoomInformation.fromData(expectedRoomInformationData)

        const builder = new RoomInformationBuilder(roomInformation)

        assert.deepEqual(builder.build(), roomInformation)
    })
})
