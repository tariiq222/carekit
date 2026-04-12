import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { TenantId } from '../../common/tenant/tenant.decorator';
import { ManageKnowledgeBaseHandler } from '../../modules/ai/manage-knowledge-base/manage-knowledge-base.handler';
import {
  ListDocumentsDto,
  UpdateDocumentDto,
} from '../../modules/ai/manage-knowledge-base/manage-knowledge-base.dto';
import { ChatCompletionHandler } from '../../modules/ai/chat-completion/chat-completion.handler';
import { ChatCompletionDto } from '../../modules/ai/chat-completion/chat-completion.dto';
import { GetChatbotConfigHandler } from '../../modules/ai/chatbot-config/get-chatbot-config.handler';
import { UpsertChatbotConfigHandler } from '../../modules/ai/chatbot-config/upsert-chatbot-config.handler';
import { UpsertChatbotConfigDto } from '../../modules/ai/chatbot-config/upsert-chatbot-config.dto';

@Controller('dashboard/ai')
@UseGuards(JwtGuard, CaslGuard)
export class DashboardAiController {
  constructor(
    private readonly knowledgeBase: ManageKnowledgeBaseHandler,
    private readonly chatCompletion: ChatCompletionHandler,
    private readonly getChatbotConfig: GetChatbotConfigHandler,
    private readonly upsertChatbotConfig: UpsertChatbotConfigHandler,
  ) {}

  // ── Knowledge Base ─────────────────────────────────────────────────────────

  @Get('knowledge-base')
  listDocuments(@TenantId() tenantId: string, @Query() query: ListDocumentsDto) {
    return this.knowledgeBase.listDocuments({ tenantId, ...query });
  }

  @Get('knowledge-base/:id')
  getDocument(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.knowledgeBase.getDocument({ tenantId, documentId: id });
  }

  @Patch('knowledge-base/:id')
  updateDocument(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateDocumentDto,
  ) {
    return this.knowledgeBase.updateDocument({ tenantId, documentId: id, ...body });
  }

  @Delete('knowledge-base/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteDocument(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.knowledgeBase.deleteDocument({ tenantId, documentId: id });
  }

  // ── Chatbot Config ────────────────────────────────────────────────────────

  @Get('chatbot-config')
  getChatbotConfigEndpoint(
    @TenantId() tenantId: string,
    @Query('category') category?: string,
  ) {
    return this.getChatbotConfig.execute({ tenantId, category });
  }

  @Patch('chatbot-config')
  @HttpCode(HttpStatus.OK)
  upsertChatbotConfigEndpoint(
    @TenantId() tenantId: string,
    @Body() body: UpsertChatbotConfigDto,
  ) {
    return this.upsertChatbotConfig.execute({ tenantId, configs: body.configs });
  }

  // ── Chat Completion ────────────────────────────────────────────────────────

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  chatCompletionEndpoint(@TenantId() tenantId: string, @Body() body: ChatCompletionDto) {
    return this.chatCompletion.execute({ tenantId, ...body });
  }
}
