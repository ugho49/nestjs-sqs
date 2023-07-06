import { SetMetadata } from '@nestjs/common';
import { SQS_CONSUMER_EVENT_HANDLER, SQS_CONSUMER_METHOD } from './sqs.constants';
import { SqsConsumerEventHandlerMeta, SqsMessageHandlerMeta } from './sqs.types';

export const SqsMessageHandler = (props: SqsMessageHandlerMeta) => SetMetadata(SQS_CONSUMER_METHOD, props);
export const SqsConsumerEventHandler = (props: SqsConsumerEventHandlerMeta) =>
  SetMetadata(SQS_CONSUMER_EVENT_HANDLER, props);
