import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { CheckPermissions } from '../auth/decorators/check-permissions.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ChatbotService, type HandleMessageResult } from './chatbot.service.js';
import { ChatbotConfigService } from './chatbot-config.service.js';
import { ChatbotRagService } from './chatbot-rag.service.js';
import { ChatbotAnalyticsService, type SessionStats } from './chatbot-analytics.service.js';
import { ChatbotFileService } from './chatbot-file.service.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { SessionListQueryDto } from './dto/session-list-query.dto.js';
import { CreateKbEntryDto, UpdateKbEntryDto } from './dto/kb-entry.dto.js';
import { UpdateChatbotConfigDto } from './dto/update-chatbot-config.dto.js';

const ADMIN_ROLE_SLUGS = ['super_admin', 'receptionist', 'accountant'];

@Controller('chatbot')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ChatbotController {
  constructor(
    private readonly chatbotService: ChatbotService,
    private readonly configService: ChatbotConfigService,
    private readonly ragService: ChatbotRagService,
    private readonly analyticsService: ChatbotAnalyticsService,
    private readonly fileService: ChatbotFileService,
  ) {}

  // ═══════════════════════════════════════════════════════════
  //  SESSIONS — Patient-facing (no permission check)
  // ═══════════════════════════════════════════════════════════

  @Post('sessions')
  async createSession(
    @Body() dto: CreateSessionDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.chatbotService.createSession(user.id, dto.language);
  }

  @Get('sessions')
  async listSessions(
    @Query() query: SessionListQueryDto,
    @CurrentUser() user: { id: string; roles?: string[] },
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
  async getSession(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.chatbotService.getSession(id, user.id);
  }

  @Post('sessions/:id/messages')
  async sendMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: { id: string },
  ): Promise<HandleMessageResult> {
    return this.chatbotService.handleMessage(id, user.id, dto.content);
  }

  @Post('sessions/:id/end')
  @HttpCode(200)
  async endSession(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.chatbotService.endSession(id, user.id);
  }

  // ═══════════════════════════════════════════════════════════
  //  KNOWLEDGE BASE — Admin only
  // ═══════════════════════════════════════════════════════════

  @Get('knowledge-base')
  @CheckPermissions({ module: 'chatbot', action: 'view' })
  async listKnowledgeBase(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('source') source?: string,
    @Query('category') category?: string,
  ) {
    return this.ragService.findAll({
      page: page ? parseInt(page, 10) : 1,
      perPage: perPage ? parseInt(perPage, 10) : 20,
      source,
      category,
    });
  }

  @Post('knowledge-base')
  @CheckPermissions({ module: 'chatbot', action: 'create' })
  async createKbEntry(@Body() dto: CreateKbEntryDto) {
    return this.ragService.upsertEntry({
      title: dto.title,
      content: dto.content,
      category: dto.category,
      source: 'manual',
    });
  }

  @Patch('knowledge-base/:id')
  @CheckPermissions({ module: 'chatbot', action: 'edit' })
  async updateKbEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateKbEntryDto,
  ) {
    return this.ragService.update(id, dto);
  }

  @Delete('knowledge-base/:id')
  @CheckPermissions({ module: 'chatbot', action: 'delete' })
  async deleteKbEntry(@Param('id', ParseUUIDPipe) id: string) {
    return this.ragService.delete(id);
  }

  @Post('knowledge-base/sync')
  @HttpCode(200)
  @CheckPermissions({ module: 'chatbot', action: 'edit' })
  async syncKnowledgeBase() {
    const count = await this.ragService.syncFromDatabase();
    return { synced: count };
  }

  // ═══════════════════════════════════════════════════════════
  //  FILES — Admin only
  // ═══════════════════════════════════════════════════════════

  @Get('knowledge-base/files')
  @CheckPermissions({ module: 'chatbot', action: 'view' })
  async listFiles(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.fileService.listFiles({
      page: page ? parseInt(page, 10) : 1,
      perPage: perPage ? parseInt(perPage, 10) : 20,
    });
  }

  @Post('knowledge-base/files/:id/process')
  @HttpCode(200)
  @CheckPermissions({ module: 'chatbot', action: 'edit' })
  async processFile(@Param('id', ParseUUIDPipe) id: string) {
    await this.fileService.processFile(id);
    return { processed: true };
  }

  @Delete('knowledge-base/files/:id')
  @CheckPermissions({ module: 'chatbot', action: 'delete' })
  async deleteFile(@Param('id', ParseUUIDPipe) id: string) {
    await this.fileService.deleteFile(id);
    return { deleted: true };
  }

  // ═══════════════════════════════════════════════════════════
  //  CONFIG — Admin only
  // ═══════════════════════════════════════════════════════════

  @Get('config')
  @CheckPermissions({ module: 'chatbot', action: 'view' })
  async getConfig() {
    return this.configService.getAll();
  }

  @Get('config/:category')
  @CheckPermissions({ module: 'chatbot', action: 'view' })
  async getConfigByCategory(@Param('category') category: string) {
    return this.configService.getByCategory(category);
  }

  @Put('config')
  @CheckPermissions({ module: 'chatbot', action: 'edit' })
  async updateConfig(@Body() dto: UpdateChatbotConfigDto) {
    return this.configService.bulkUpsert(dto.configs);
  }

  @Post('config/seed')
  @HttpCode(200)
  @CheckPermissions({ module: 'chatbot', action: 'edit' })
  async seedDefaults() {
    const count = await this.configService.seedDefaults();
    return { seeded: count };
  }

  // ═══════════════════════════════════════════════════════════
  //  ANALYTICS — Admin only
  // ═══════════════════════════════════════════════════════════

  @Get('analytics')
  @CheckPermissions({ module: 'chatbot', action: 'view' })
  async getAnalytics(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<SessionStats> {
    return this.analyticsService.getSessionStats({ from, to });
  }

  @Get('analytics/questions')
  @CheckPermissions({ module: 'chatbot', action: 'view' })
  async getMostAskedQuestions(@Query('limit') limit?: string) {
    return this.analyticsService.getMostAskedQuestions(
      limit ? parseInt(limit, 10) : 10,
    );
  }

  // ── Helper ──

  private isAdmin(user: { roles?: string[] }): boolean {
    return (user.roles ?? []).some((r) => ADMIN_ROLE_SLUGS.includes(r));
  }
}
