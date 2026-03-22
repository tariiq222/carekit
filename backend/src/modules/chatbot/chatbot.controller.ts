import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { CheckPermissions } from '../auth/decorators/check-permissions.decorator.js';

@Controller('chatbot')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ChatbotController {
  @Get('sessions')
  @CheckPermissions({ module: 'chatbot', action: 'view' })
  async getSessions() {
    return [];
  }

  // POST /chatbot/message is available to all authenticated users (patients use chatbot)
  // No permission check needed — this is the patient-facing chatbot endpoint
  @Post('message')
  async sendMessage(@Body() body: Record<string, unknown>) {
    return body;
  }
}
