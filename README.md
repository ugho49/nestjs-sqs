# nestjs-sqs

Tested with: [AWS SQS](https://aws.amazon.com/en/sqs/) and [Localstack](https://github.com/localstack/localstack).

Nestjs-sqs is a project to make SQS easier to use and control some required flows with NestJS.
This module provides decorator-based message handling suited for simple use.

This library internally uses [bbc/sqs-producer](https://github.com/bbc/sqs-producer) and [bbc/sqs-consumer](https://github.com/bbc/sqs-consumer), and implements some more useful features on top of the basic functionality given by them.

## Installation

```shell script
$ npm i --save @ugho49/nestjs-sqs
```

## Quick Start

### Register module

Just register this module:

```ts
@Module({
  imports: [
    SqsModule.register({
      consumers: [],
      producers: [],
    }),
  ],
})
class AppModule {}
```

Quite often you might want to asynchronously pass module options instead of passing them beforehand.
In such case, use `registerAsync()` method like many other Nest.js libraries.

- Use factory

```ts
SqsModule.registerAsync({
  useFactory: () => {
    return {
      consumers: [],
      producers: [],
    };
  },
});
```

- Use class

```ts
SqsModule.registerAsync({
  useClass: SqsConfigService,
});
```

- Use existing

```ts
SqsModule.registerAsync({
  imports: [ConfigModule],
  useExisting: ConfigService,
});
```

### Decorate methods

You need to decorate methods in your NestJS providers in order to have them be automatically attached as event handlers for incoming SQS messages:

```ts
import { Message } from '@aws-sdk/client-sqs';

@Injectable()
export class AppMessageHandler {
  @SqsMessageHandler({ name: "queueName", batch: false })
  public async handleMessage(message: Message) {}

  @SqsConsumerEventHandler({ name: "queueName", eventName: "processing_error" })
  public onProcessingError(error: Error, message: Message) {
    // report errors here
  }
}
```

### Produce messages

```ts
export class AppService {
  public constructor(
    private readonly sqsService: SqsService,
  ) { }

  public async simpleDispatch() {
    await this.sqsService.send('queueName', {
      body: { ... },
    });
  }

  public async fullDispatch() {
    await this.sqsService.send('queueName', {
      id: 'id',
      body: { ... },
      groupId: 'groupId',
      deduplicationId: 'deduplicationId',
      messageAttributes: { ... },
      delaySeconds: 0,
    });
  }
}
```

### Configuration

See [here](https://github.com/ssut/nestjs-sqs/blob/master/lib/sqs.types.ts), and note that we have same configuration as [bbc/sqs-consumer's](https://github.com/bbc/sqs-producer).
In most time you just need to specify both `name` and `queueUrl` at the minimum requirements.

## License

This project is licensed under the terms of the MIT license.
