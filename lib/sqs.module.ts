import { Global, Module } from '@nestjs/common';
import { SqsService } from './sqs.service';
import { DiscoveryModule } from '@golevelup/nestjs-discovery';
import { ConfigurableModuleClass } from './sqs.config';

@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [SqsService],
  exports: [SqsService],
})
export class SqsModule extends ConfigurableModuleClass {}
