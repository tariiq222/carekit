import { Global, Module } from '@nestjs/common';
import { OpenRouterService } from './openrouter.service.js';

@Global()
@Module({
  providers: [OpenRouterService],
  exports: [OpenRouterService],
})
export class AiServiceModule {}
