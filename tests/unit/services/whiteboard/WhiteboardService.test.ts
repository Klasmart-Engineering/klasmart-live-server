import { WhiteboardService } from "../../../../src/services/whiteboard/WhiteboardService";
import { Cluster } from "ioredis";
import { Context } from "../../../../src/types";
import { PainterEvent } from "../../../../src/services/whiteboard/events/PainterEvent";



describe("whiteboardService", () => {
  // Mock redis cluster
  const fakeRedisCluster = {} as any as Cluster;

  describe("whiteboardSendEvent", () => {
    
    const testWhiteboardService = new WhiteboardService(fakeRedisCluster);

    it("should resolve falsy when event is not object or PainterEvent type", async () => {
      const context = {
        authorizationToken: {}
      } as any as Context

      const event = "test";
      const received = await testWhiteboardService.whiteboardSendEvent(context, event);
      expect(received).toBeFalsy();
    });

    it("should pass the test and resolve turth when right data send", async () => {

      // mock private function
      const spyAddPainterEventToStream = jest.spyOn(testWhiteboardService as any, "addPainterEventToStream");
      spyAddPainterEventToStream.mockImplementation(async () =>{
        return true
      });
      
      const context = {
        authorizationToken: {
          roomId: "roomId"
        }
      } as any as Context
      const event = {
        type: "type",
        id: "id",
        generatedBy: "generatedBy",
        objectType: "objectType",
        param: "param"
      } as PainterEvent;
      const received = await testWhiteboardService.whiteboardSendEvent(context, JSON.stringify(event));
      expect(received).toBeTruthy();
    })

  })
})