import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ChatbotService, type HandleMessageResult } from './chatbot.service.js';
import { ChatbotStreamService } from './chatbot-stream.service.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { SessionListQueryDto } from './dto/session-list-query.dto.js';
import { ADMIN_ROLE_SLUGS } from '../../config/constants.js';

@ApiTags('Chatbot')
@ApiBearerAuth()
@Controller('chatbot')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ChatbotController {
  constructor(
    private readonly chatbotService: ChatbotService,
    private readonly streamService: ChatbotStreamService,
  ) {}

  // ═══════════════════════════════════════════════════════════
  //  SESSIONS — Patient-facing (no permission check)
  // ═══════════════════════════════════════════════════════════

  @Post('sessions')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @CheckPermissions({ module: 'chatbot', action: 'create' })
  async createSession(
    @Body() dto: CreateSessionDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.chatbotService.createSession(user.id, dto.language);
  }

  @Get('sessions')
  @CheckPermissions({ module: 'chatbot', action: 'view' })
  async listSessions(
    @Query() query: SessionListQueryDto,
    @CurrentUser() user: { id: string; roles?: Array<{ slug: string }> },
  ) {
    const isAdmin = this.isAdmin(user);
    return this.chatbotService.listSessions({
      userId: isAdmin ? undefined : user.id,
      page: query.page ? parseInt(query.page, 10) : 1,
      perPage: query.perPage ? parseInt(query.perPage, 10) : 20,
      handedOff: query.handedOff === 'true' ? true : query.handedOff === 'false' ? false : undefined,
      language: query.language,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });
  }

  @Get('sessions/:id')
  @CheckPermissions({ module: 'chatbot', action: 'view' })
  async getSession(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.chatbotService.getSession(id, user.id);
  }

  @Post('sessions/:id/messages')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @CheckPermissions({ module: 'chatbot', action: 'create' })
  async sendMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: { id: string },
  ): Promise<HandleMessageResult> {
    return this.chatbotService.handleMessage(id, user.id, dto.content);
  }

  /**
   * SSE streaming variant of sendMessage.
   * Returns a text/event-stream response with typed events:
   * text, tool, action, done, error.
   */
  @Post('sessions/:id/messages/stream')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @CheckPermissions({ module: 'chatbot', action: 'create' })
  async streamMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: { id: string },
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const observable = this.streamService.handleMessageStream(
      id,
      user.id,
      dto.content,
    );

    observable.subscribe({
      next: (event: MessageEvent) => {
        res.write(`data: ${typeof event.data === 'string' ? event.data : JSON.stringify(event.data)}\n\n`);
      },
      complete: () => {
        res.write('data: [DONE]\n\n');
        res.end();
      },
      error: (err: Error) => {
        const payload = JSON.stringify({ event: 'error', message: err.message });
        res.write(`data: ${payload}\n\n`);
        res.end();
      },
    });
  }

  @Post('sessions/:id/end')
  @HttpCode(200)
  @CheckPermissions({ module: 'chatbot', action: 'edit' })
  async endSession(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.chatbotService.endSession(id, user.id);
  }

  // ── Helper ──

  private isAdmin(user: { roles?: Array<{ slug: string }> }): boolean {
    return (user.roles ?? []).some((r) =>
      (ADMIN_ROLE_SLUGS as readonly string[]).includes(r.slug),
    );
  }
}
