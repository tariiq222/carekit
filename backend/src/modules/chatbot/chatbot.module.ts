import { Module } from '@nestjs/common';
import { ChatbotController } from './chatbot.controller.js';
import { ChatbotKbController } from './chatbot-kb.controller.js';
import { ChatbotAdminController } from './chatbot-admin.controller.js';
import { ChatbotService } from './chatbot.service.js';
import { ChatbotAiService } from './chatbot-ai.service.js';
import { ChatbotToolsService } from './chatbot-tools.service.js';
import { ChatbotRagService } from './chatbot-rag.service.js';
import { ChatbotConfigService } from './chatbot-config.service.js';
import { ChatbotContextService } from './chatbot-context.service.js';
import { ChatbotAnalyticsService } from './chatbot-analytics.service.js';
import { ChatbotFileService } from './chatbot-file.service.js';
import { ChatbotStreamService } from './chatbot-stream.service.js';
import { ChatbotStreamLoopService } from './chatbot-stream-loop.service.js';
import { BookingsModule } from '../bookings/bookings.module.js';
import { ServicesModule } from '../services/services.module.js';
import { PractitionersModule } from '../practitioners/practitioners.module.js';
import { BookingsService } from '../bookings/bookings.service.js';
import { ServicesService } from '../services/services.service.js';
import { PractitionersService } from '../practitioners/practitioners.service.js';
import {
  CHATBOT_BOOKING_PORT,
  CHATBOT_SERVICE_PORT,
  CHATBOT_PRACTITIONER_PORT,
} from './interfaces/chatbot-domain.interface.js';

@Module({
  imports: [BookingsModule, ServicesModule, PractitionersModule],
  controllers: [ChatbotController, ChatbotKbController, ChatbotAdminController],
  providers: [
    ChatbotService,
    ChatbotAiService,
    ChatbotToolsService,
    ChatbotRagService,
    ChatbotConfigService,
    ChatbotContextService,
    ChatbotAnalyticsService,
    ChatbotFileService,
    ChatbotStreamService,
    ChatbotStreamLoopService,
    // L1: Port bindings — concrete services registered as interface tokens
    { provide: CHATBOT_BOOKING_PORT, useExisting: BookingsService },
    { provide: CHATBOT_SERVICE_PORT, useExisting: ServicesService },
    { provide: CHATBOT_PRACTITIONER_PORT, useExisting: PractitionersService },
  ],
  exports: [ChatbotService, ChatbotConfigService],
})
export class ChatbotModule {}
