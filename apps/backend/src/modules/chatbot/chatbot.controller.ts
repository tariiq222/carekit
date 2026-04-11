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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { FeatureFlagGuard } from '../../common/guards/feature-flag.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { RequireFeature } from '../../common/decorators/require-feature.decorator.js';
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
@UseGuards(JwtAuthGuard, PermissionsGuard, FeatureFlagGuard)
@RequireFeature('chatbot')
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
  @CheckPermissions({ module: 'chatbot', action: 'use' })
  @ApiOperation({ summary: 'Create a new chatbot session' })
  @ApiResponse({ status: 201, description: 'Session created' })
  @ApiStandardResponses()
  async createSession(
    @Body() dto: CreateSessionDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.chatbotService.createSession(user.id, dto.language);
  }

  @Get('sessions')
  @CheckPermissions({ module: 'chatbot', action: 'use' })
  @ApiOperation({ summary: 'List chatbot sessions' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'perPage', required: false, description: 'Items per page' })
  @ApiQuery({ name: 'handedOff', required: false, description: 'Filter by hand-off status (true/false)' })
  @ApiQuery({ name: 'language', required: false, description: 'Filter by language' })
  @ApiQuery({ name: 'dateFrom', required: false, description: 'Start date filter (ISO 8601)' })
  @ApiQuery({ name: 'dateTo', required: false, description: 'End date filter (ISO 8601)' })
  @ApiResponse({ status: 200, description: 'Paginated session list' })
  @ApiStandardResponses()
  async listSessions(
    @Query() query: SessionListQueryDto,
    @CurrentUser() user: { id: string; roles?: Array<{ slug: string }> },
  ) {
    const isAdmin = this.isAdmin(user);
    return this.chatbotService.listSessions({
      userId: isAdmin ? undefined : user.id,
      page: query.page ? parseInt(query.page, 10) : 1,
      perPage: query.perPage ? parseInt(query.perPage, 10) : 20,
      handedOff:
        query.handedOff === 'true'
          ? true
          : query.handedOff === 'false'
            ? false
            : undefined,
      language: query.language,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });
  }

  @Get('sessions/:id')
  @CheckPermissions({ module: 'chatbot', action: 'use' })
  @ApiOperation({ summary: 'Get a chatbot session by ID' })
  @ApiParam({ name: 'id', description: 'Session UUID' })
  @ApiResponse({ status: 200, description: 'Session details' })
  @ApiStandardResponses()
  async getSession(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.chatbotService.getSession(id, user.id);
  }

  @Post('sessions/:id/messages')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @CheckPermissions({ module: 'chatbot', action: 'use' })
  @ApiOperation({ summary: 'Send a message in a chatbot session' })
  @ApiParam({ name: 'id', description: 'Session UUID' })
  @ApiResponse({ status: 201, description: 'AI response returned' })
  @ApiStandardResponses()
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
  @CheckPermissions({ module: 'chatbot', action: 'use' })
  @ApiOperation({ summary: 'Stream a chatbot message response via SSE' })
  @ApiParam({ name: 'id', description: 'Session UUID' })
  @ApiResponse({ status: 200, description: 'SSE stream (text/event-stream) — events: text, tool, action, done, error' })
  @ApiStandardResponses()
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
        res.write(
          `data: ${typeof event.data === 'string' ? event.data : JSON.stringify(event.data)}\n\n`,
        );
      },
      complete: () => {
        res.write('data: [DONE]\n\n');
        res.end();
      },
      error: (err: Error) => {
        const payload = JSON.stringify({
          event: 'error',
          message: err.message,
        });
        res.write(`data: ${payload}\n\n`);
        res.end();
      },
    });
  }

  @Post('sessions/:id/end')
  @HttpCode(200)
  @CheckPermissions({ module: 'chatbot', action: 'use' })
  @ApiOperation({ summary: 'End a chatbot session' })
  @ApiParam({ name: 'id', description: 'Session UUID' })
  @ApiResponse({ status: 200, description: 'Session ended' })
  @ApiStandardResponses()
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
