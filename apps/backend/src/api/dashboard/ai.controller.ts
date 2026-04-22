import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery,
  ApiOkResponse, ApiNoContentResponse, ApiResponse,
} from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger';
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

@ApiTags('Dashboard / AI')
@ApiBearerAuth()
@ApiStandardResponses()
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
  @ApiOperation({ summary: 'List knowledge-base documents' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by document status', example: 'ACTIVE' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Results per page', example: 20 })
  @ApiOkResponse({ description: 'Paginated list of knowledge-base documents' })
  listDocuments(@Query() query: ListDocumentsDto) {
    return this.knowledgeBase.listDocuments(query);
  }

  @Get('knowledge-base/:id')
  @ApiOperation({ summary: 'Get a knowledge-base document by ID' })
  @ApiParam({ name: 'id', description: 'Document UUID', example: '00000000-0000-0000-0000-000000000001' })
  @ApiOkResponse({ description: 'Document detail' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  getDocument(@Param('id', ParseUUIDPipe) id: string) {
    return this.knowledgeBase.getDocument({ documentId: id });
  }

  @Patch('knowledge-base/:id')
  @ApiOperation({ summary: 'Update a knowledge-base document' })
  @ApiParam({ name: 'id', description: 'Document UUID', example: '00000000-0000-0000-0000-000000000001' })
  @ApiOkResponse({ description: 'Updated document' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  updateDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateDocumentDto,
  ) {
    return this.knowledgeBase.updateDocument({ documentId: id, ...body });
  }

  @Delete('knowledge-base/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a knowledge-base document' })
  @ApiParam({ name: 'id', description: 'Document UUID', example: '00000000-0000-0000-0000-000000000001' })
  @ApiNoContentResponse({ description: 'Document deleted' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  deleteDocument(@Param('id', ParseUUIDPipe) id: string) {
    return this.knowledgeBase.deleteDocument({ documentId: id });
  }

  // ── Chatbot Config ────────────────────────────────────────────────────────

  @Get('chatbot-config')
  @ApiOperation({ summary: 'Get chatbot configuration (org-unique singleton)' })
  @ApiOkResponse({ description: 'Chatbot configuration for the current org (created on first read)' })
  getChatbotConfigEndpoint() {
    return this.getChatbotConfig.execute();
  }

  @Patch('chatbot-config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upsert chatbot configuration (org-unique singleton)' })
  @ApiOkResponse({ description: 'Updated chatbot configuration' })
  upsertChatbotConfigEndpoint(@Body() body: UpsertChatbotConfigDto) {
    return this.upsertChatbotConfig.execute(body);
  }

  // ── Chat Completion ────────────────────────────────────────────────────────

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a chat message and receive an AI reply (Server-Sent Events)' })
  @ApiOkResponse({
    description: 'SSE stream of the AI reply',
    schema: { type: 'string', description: 'SSE stream' },
  })
  chatCompletionEndpoint(@Body() body: ChatCompletionDto) {
    return this.chatCompletion.execute(body);
  }
}
