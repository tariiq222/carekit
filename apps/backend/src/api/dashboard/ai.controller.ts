import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
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

@ApiTags('AI')
@ApiBearerAuth()
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
  listDocuments(@Query() query: ListDocumentsDto) {
    return this.knowledgeBase.listDocuments(query);
  }

  @Get('knowledge-base/:id')
  getDocument(@Param('id', ParseUUIDPipe) id: string) {
    return this.knowledgeBase.getDocument({ documentId: id });
  }

  @Patch('knowledge-base/:id')
  updateDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateDocumentDto,
  ) {
    return this.knowledgeBase.updateDocument({ documentId: id, ...body });
  }

  @Delete('knowledge-base/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteDocument(@Param('id', ParseUUIDPipe) id: string) {
    return this.knowledgeBase.deleteDocument({ documentId: id });
  }

  // ── Chatbot Config ────────────────────────────────────────────────────────

  @Get('chatbot-config')
  getChatbotConfigEndpoint(@Query('category') category?: string) {
    return this.getChatbotConfig.execute({ category });
  }

  @Patch('chatbot-config')
  @HttpCode(HttpStatus.OK)
  upsertChatbotConfigEndpoint(@Body() body: UpsertChatbotConfigDto) {
    return this.upsertChatbotConfig.execute({ configs: body.configs });
  }

  // ── Chat Completion ────────────────────────────────────────────────────────

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  chatCompletionEndpoint(@Body() body: ChatCompletionDto) {
    return this.chatCompletion.execute(body);
  }
}
