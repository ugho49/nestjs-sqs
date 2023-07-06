import type { ConsumerOptions } from 'sqs-consumer';
import type { ProducerOptions, Message as ProducerMessage } from 'sqs-producer';
import type { LoggerService } from '@nestjs/common';
import type { SQSClient } from '@aws-sdk/client-sqs';

export type QueueName = string;

export type SqsConsumerOptions = Omit<ConsumerOptions, 'handleMessage' | 'handleMessageBatch'> & {
  name: QueueName;
};

export type SqsProducerOptions = ProducerOptions & {
  name: QueueName;
};

export interface SqsOptions {
  sqs?: SQSClient;
  logger?: LoggerService;
  consumers?: SqsConsumerOptions[];
  producers?: SqsProducerOptions[];
}

export interface Message<T = unknown> extends Omit<ProducerMessage, 'id' | 'body'> {
  id?: string;
  body: T;
}

export interface SqsMessageHandlerMeta {
  name: string;
  batch?: boolean;
}

export interface SqsConsumerEventHandlerMeta {
  name: string;
  eventName: string;
}
