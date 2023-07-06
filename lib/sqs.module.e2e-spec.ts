import { Test, TestingModule } from '@nestjs/testing';
import { Injectable } from '@nestjs/common';
import { Message, SQSClient } from '@aws-sdk/client-sqs';
import {
  SqsModule,
  SqsService,
  SqsConsumerEventHandler,
  SqsMessageHandler,
  SqsConsumerOptions,
  SqsProducerOptions,
} from './index';
import waitForExpect from 'wait-for-expect';

const SQS_ENDPOINT = 'http://localhost:4566';

const sqs = new SQSClient({
  apiVersion: '2012-11-05',
  credentials: { accessKeyId: 'x', secretAccessKey: 'x' },
  endpoint: SQS_ENDPOINT,
  region: 'eu-west-1',
});

const testQueue1: SqsConsumerOptions | SqsProducerOptions = {
  name: 'test1',
  queueUrl: `${SQS_ENDPOINT}/000000000000/test1`,
};

const testQueue2: SqsConsumerOptions | SqsProducerOptions = {
  name: 'test2',
  queueUrl: `${SQS_ENDPOINT}/000000000000/test2`,
};

const queues = [testQueue1, testQueue2];

describe('SqsModule', () => {
  describe('registerAsync', () => {
    it('should register module async', async () => {
      const module = await Test.createTestingModule({
        imports: [
          SqsModule.registerAsync({
            useFactory: async () => {
              return {
                sqs,
                consumers: [testQueue1],
                producers: [testQueue2],
              };
            },
          }),
        ],
      }).compile();

      const sqsService = module.get(SqsService);
      expect(sqsService).toBeTruthy();
      expect(sqsService.options.consumers).toHaveLength(1);
      expect(sqsService.options.producers).toHaveLength(1);
    });
  });

  describe('full flow', () => {
    let module: TestingModule;
    const fakeQueue1Processor = jest.fn();
    const fakeQueue2Processor = jest.fn();
    const fakeErrorEventHandler = jest.fn();

    @Injectable()
    class A {
      public constructor(public readonly sqsService: SqsService) {}

      @SqsMessageHandler({ name: testQueue1.name })
      public async handleQueue1Message(message: Message) {
        fakeQueue1Processor(message);
      }

      @SqsConsumerEventHandler({ name: testQueue1.name, eventName: 'processing_error' })
      public handleErrorEvent(err: Error, message: Message) {
        fakeErrorEventHandler(err, message);
      }

      @SqsMessageHandler({ name: testQueue2.name })
      public async handleQueue2Message(message: Message) {
        fakeQueue2Processor(message);
      }
    }

    beforeAll(async () => {
      module = await Test.createTestingModule({
        imports: [
          SqsModule.register({
            sqs,
            producers: [testQueue1],
            consumers: [
              {
                ...testQueue1,
                waitTimeSeconds: 1,
                batchSize: 3,
                terminateVisibilityTimeout: true,
                messageAttributeNames: ['All'],
              },
              {
                ...testQueue2,
                waitTimeSeconds: 1,
              },
            ],
          }),
        ],
        providers: [A],
      }).compile();
      await module.init();
    });

    beforeEach(async () => {
      fakeQueue1Processor.mockRestore();
      fakeErrorEventHandler.mockRestore();
      const sqsService = module.get(SqsService);
      await Promise.all(Object.values(queues).map(({ name }) => sqsService.purgeQueue(name)));
    });

    afterAll(async () => {
      fakeQueue2Processor.mockReset();
      await module.close();
    });

    it('should register message handler', () => {
      const sqsService = module.get(SqsService);
      expect(sqsService.consumers.has(testQueue1.name)).toBe(true);
      expect(sqsService.consumers.has(testQueue2.name)).toBe(true);
    });

    it('should register message producer', () => {
      const sqsService = module.get(SqsService);
      expect(sqsService.producers.has(testQueue1.name)).toBe(true);
    });

    it('should call message handler when a new message has come', async () => {
      jest.setTimeout(30000);

      const sqsService = module.get(SqsService);
      const id = String(Math.floor(Math.random() * 1000000));

      fakeQueue1Processor.mockImplementationOnce((message) => {
        expect(message).toBeTruthy();
        expect(JSON.parse(message.Body)).toStrictEqual({ test: true });
      });

      await sqsService.send(testQueue1.name, {
        id,
        body: { test: true },
        delaySeconds: 0,
      });
    });

    it('should call message handler multiple times when multiple messages have come', async () => {
      jest.setTimeout(5000);

      const sqsService = module.get(SqsService);
      const groupId = String(Math.floor(Math.random() * 1000000));

      for (let i = 0; i < 3; i++) {
        const id = `${groupId}_${i}`;
        await sqsService.send(testQueue1.name, {
          id,
          body: { test: true, i },
          delaySeconds: 0,
        });
      }

      await waitForExpect(
        () => {
          expect(fakeQueue1Processor.mock.calls).toHaveLength(3);
          for (const call of fakeQueue1Processor.mock.calls) {
            expect(call).toHaveLength(1);
            expect(call[0]).toBeTruthy();
          }
        },
        5000,
        100,
      );
    });

    it('should call the registered error handler when an error occurs', async () => {
      jest.setTimeout(10000);

      const sqsService = module.get(SqsService);
      const id = String(Math.floor(Math.random() * 1000000));

      fakeQueue1Processor.mockImplementationOnce(() => {
        throw new Error('test');
      });

      fakeErrorEventHandler.mockImplementationOnce((error) => {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('test');
      });

      await sqsService.send(testQueue1.name, {
        id,
        body: { test: true },
        delaySeconds: 0,
      });
    });
  });
});
