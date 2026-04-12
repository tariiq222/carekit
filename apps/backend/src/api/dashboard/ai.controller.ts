import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  IsInt, IsObject, IsOptional, IsString, Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { TenantId } from '../../common/tenant/tenant.decorator';
import { ManageKnowledgeBaseHandler } from '../../modules/ai/manage-knowledge-base/manage-knowledge-base.handler';
import { ChatCompletionHandler } from '../../modules/ai/chat-completion/chat-completion.handler';

// ── Knowledge Base DTOs ───────────────────────────────────────────────────────

export class ListDocumentsQuery {
  @IsOptional() @IsString() status?: 'PENDING' | 'EMBEDDED' | 'FAILED';
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) page?: number;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) limit?: number;
}

export class UpdateDocumentBody {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

// ── Chat Completion DTOs ──────────────────────────────────────────────────────

export class ChatCompletionBody {
  @IsString() userMessage!: string;
  @IsOptional() @IsString() sessionId?: string;
  @IsOptional() @IsString() clientId?: string;
  @IsOptional() @IsString() userId?: string;
}

// ── Controller ────────────────────────────────────────────────────────────────

@Controller('dashboard/ai')
@UseGuards(JwtGuard, CaslGuard)
export class DashboardAiController {
  constructor(
    private readonly knowledgeBase: ManageKnowledgeBaseHandler,
    private readonly chatCompletion: ChatCompletionHandler,
  ) {}

  // ── Knowledge Base ─────────────────────────────────────────────────────────

  @Get('knowledge-base')
  listDocuments(@TenantId() tenantId: string, @Query() query: ListDocumentsQuery) {
    return this.knowledgeBase.listDocuments({
      tenantId,
      status: query.status,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
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
    @Body() body: UpdateDocumentBody,
  ) {
    return this.knowledgeBase.updateDocument({
      tenantId,
      documentId: id,
      title: body.title,
      metadata: body.metadata,
    });
  }

  @Delete('knowledge-base/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteDocument(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.knowledgeBase.deleteDocument({ tenantId, documentId: id });
  }

  // ── Chat Completion ────────────────────────────────────────────────────────

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  chatCompletionEndpoint(@TenantId() tenantId: string, @Body() body: ChatCompletionBody) {
    return this.chatCompletion.execute({ tenantId, ...body });
  }
}
