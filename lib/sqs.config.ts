import { ConfigurableModuleBuilder } from '@nestjs/common';
import { SqsOptions } from './sqs.types';

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } = new ConfigurableModuleBuilder<SqsOptions>().build();
