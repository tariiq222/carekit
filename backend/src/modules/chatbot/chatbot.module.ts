import { Module } from '@nestjs/common';
import { ChatbotController } from './chatbot.controller.js';

@Module({
  controllers: [ChatbotController],
})
export class ChatbotModule {}
