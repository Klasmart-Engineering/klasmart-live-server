import AWS = require('aws-sdk');
import DynamoService = require('aws-sdk/clients/dynamodb');

// Set the region
AWS.config.update({ region: 'ap-northeast-2' });

const docClient = new DynamoService.DocumentClient({ apiVersion: '2012-08-10' });


interface PageEvent {
  sequenceNumber: number
  isKeyframe: boolean
  eventsSinceKeyframe: number
  eventData: string
}

export class Persist {

    public static async createDynamoClient(tablename: string) {
        try {
            const params: DynamoService.DocumentClient.GetItemInput = {
                Key: {
                    'streamId': 'test_stream',
                    'sequence': 0
                },
                TableName: tablename,
            };
            const res = await docClient.get(params).promise();
            console.log(`✅ Access to DynamoDB table' ${tablename} allowed`)
        } catch (e) {
            console.log('✘ Access to DynamoDB denied')
            throw e
        }
        return new Persist(tablename)
    }

  private tablename: string
  constructor(tablename: string) {
      this.tablename = tablename
  }

  public async savePageEvent(streamId: string, pageEvents: PageEvent[]) {
    
      for (const { sequenceNumber, eventsSinceKeyframe, isKeyframe, eventData } of pageEvents) {
          try {
              const params: DynamoService.DocumentClient.PutItemInput = {
                  Item: {
                      'streamId': streamId,
                      'sequence': sequenceNumber,
                      'eventsSinceKeyframe': eventsSinceKeyframe,
                      'isKeyframe': isKeyframe,
                      'eventData': eventData
                  },
                  TableName: this.tablename,
              };
              await docClient.put(params).promise();
          } catch (e) {
              console.log(e)
              return false
          }

      }
      return true
  }

}
