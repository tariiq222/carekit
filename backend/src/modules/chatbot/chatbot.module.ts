import { Module } from '@nestjs/common';
import { ChatbotController } from './chatbot.controller.js';
import { ChatbotService } from './chatbot.service.js';
import { ChatbotAiService } from './chatbot-ai.service.js';
import { ChatbotToolsService } from './chatbot-tools.service.js';
import { ChatbotRagService } from './chatbot-rag.service.js';
import { ChatbotConfigService } from './chatbot-config.service.js';
import { ChatbotAnalyticsService } from './chatbot-analytics.service.js';
import { ChatbotFileService } from './chatbot-file.service.js';
import { BookingsModule } from '../bookings/bookings.module.js';
import { ServicesModule } from '../services/services.module.js';
import { PractitionersModule } from '../practitioners/practitioners.module.js';

@Module({
  imports: [BookingsModule, ServicesModule, PractitionersModule],
  controllers: [ChatbotController],
  providers: [
    ChatbotService,
    ChatbotAiService,
    ChatbotToolsService,
    ChatbotRagService,
    ChatbotConfigService,
    ChatbotAnalyticsService,
    ChatbotFileService,
  ],
  exports: [ChatbotService, ChatbotConfigService],
})
export class ChatbotModule {}
