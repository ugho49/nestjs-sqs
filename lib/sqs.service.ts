import { Inject, Injectable, Logger, LoggerService, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Consumer } from 'sqs-consumer';
import { Producer } from 'sqs-producer';
import { GetQueueAttributesCommand, PurgeQueueCommand, QueueAttributeName, SQSClient } from '@aws-sdk/client-sqs';
import { Message, QueueName, SqsConsumerEventHandlerMeta, SqsMessageHandlerMeta, SqsOptions } from './sqs.types';
import { DiscoveryService } from '@golevelup/nestjs-discovery';
import { SQS_CONSUMER_EVENT_HANDLER, SQS_CONSUMER_METHOD } from './sqs.constants';
import { MODULE_OPTIONS_TOKEN } from './sqs.config';
import type { Message as ProducerMessage } from 'sqs-producer';

@Injectable()
export class SqsService implements OnModuleInit, OnModuleDestroy {
  public readonly consumers = new Map<QueueName, Consumer>();
  public readonly producers = new Map<QueueName, Producer>();

  private logger: LoggerService;

  public constructor(
    @Inject(MODULE_OPTIONS_TOKEN) public readonly options: SqsOptions,
    private readonly discover: DiscoveryService,
  ) {
    this.logger = this.options.logger ?? new Logger(SqsService.name, { timestamp: false });
  }

  public async onModuleInit(): Promise<void> {
    this.createProducers();
    await this.createConsumers();

    for (const consumer of this.consumers.values()) {
      consumer.start();
    }
  }

  private createProducers() {
    this.options.producers?.forEach((options) => {
      const { name, ...producerOptions } = options;
      if (this.producers.has(name)) {
        throw new Error(`Producer already exists: ${name}`);
      }

      const { sqs } = producerOptions;
      const producer = Producer.create({ ...producerOptions, sqs: sqs ?? this.options.sqs });
      this.logger.debug(`Create producer: ${name}`);
      this.producers.set(name, producer);
    });
  }

  private async createConsumers() {
    const messageHandlers = await this.discover.providerMethodsWithMetaAtKey<SqsMessageHandlerMeta>(
      SQS_CONSUMER_METHOD,
    );
    const eventHandlers = await this.discover.providerMethodsWithMetaAtKey<SqsConsumerEventHandlerMeta>(
      SQS_CONSUMER_EVENT_HANDLER,
    );

    this.options.consumers?.forEach((options) => {
      const { name, ...consumerOptions } = options;
      if (this.consumers.has(name)) {
        throw new Error(`Consumer already exists: ${name}`);
      }

      const metadata = messageHandlers.find(({ meta }) => meta.name === name);
      if (!metadata) {
        this.logger.warn(`No handler found for: ${name}`);
      }

      const { sqs } = consumerOptions;
      const isBatchHandler = metadata.meta.batch === true;
      const handleMessage = metadata.discoveredMethod.handler.bind(metadata.discoveredMethod.parentClass.instance);
      const consumer = Consumer.create({
        ...consumerOptions,
        sqs: sqs ?? this.options.sqs,
        ...(isBatchHandler ? { handleMessageBatch: handleMessage } : { handleMessage }),
      });

      this.logger.debug(`Create consumer: ${name}`);

      const eventsMetadata = eventHandlers.filter(({ meta }) => meta.name === name);
      for (const eventMetadata of eventsMetadata) {
        if (eventMetadata) {
          consumer.addListener(
            eventMetadata.meta.eventName,
            eventMetadata.discoveredMethod.handler.bind(metadata.discoveredMethod.parentClass.instance),
          );
        }
      }
      this.consumers.set(name, consumer);
    });
  }

  public onModuleDestroy() {
    for (const consumer of this.consumers.values()) {
      consumer.stop();
    }
  }

  private getQueueInfo(name: QueueName) {
    if (!this.consumers.has(name) && !this.producers.has(name)) {
      throw new Error(`Consumer/Producer does not exist: ${name}`);
    }

    const { sqs, queueUrl } = (this.consumers.get(name) ?? this.producers.get(name)) as {
      sqs: SQSClient;
      queueUrl: string;
    };
    if (!sqs) {
      throw new Error('SQS instance does not exist');
    }

    return {
      sqs,
      queueUrl,
    };
  }

  public async purgeQueue(name: QueueName) {
    const { sqs, queueUrl } = this.getQueueInfo(name);
    const command = new PurgeQueueCommand({
      QueueUrl: queueUrl,
    });
    return await sqs.send(command);
  }

  public async getQueueAttributes(name: QueueName) {
    const { sqs, queueUrl } = this.getQueueInfo(name);
    const command = new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: ['All'],
    });
    const response = await sqs.send(command);
    return response.Attributes as Record<QueueAttributeName, string>;
  }

  public getProducerQueueSize(name: QueueName) {
    if (!this.producers.has(name)) {
      throw new Error(`Producer does not exist: ${name}`);
    }

    return this.producers.get(name).queueSize();
  }

  public send<T = unknown>(name: QueueName, payload: Message<T> | Message<T>[]) {
    if (!this.producers.has(name)) {
      throw new Error(`Producer does not exist: ${name}`);
    }

    const originalMessages = Array.isArray(payload) ? payload : [payload];
    const messages: ProducerMessage[] = originalMessages.map((message) => {
      const { body, id } = message;

      return {
        ...message,
        id: id ?? uuidv4(),
        body: typeof body !== 'string' ? JSON.stringify(body) : body,
      };
    });

    const producer = this.producers.get(name);
    return producer.send(messages);
  }
}
