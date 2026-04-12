import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  IsBoolean, IsInt, IsOptional, IsString, IsUUID, Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { TenantId } from '../../common/tenant/tenant.decorator';
import { ListNotificationsHandler } from '../../modules/comms/notifications/list-notifications.handler';
import { MarkReadHandler } from '../../modules/comms/notifications/mark-read.handler';
import { ListEmailTemplatesHandler } from '../../modules/comms/email-templates/list-email-templates.handler';
import { GetEmailTemplateHandler } from '../../modules/comms/email-templates/get-email-template.handler';
import { CreateEmailTemplateHandler } from '../../modules/comms/email-templates/create-email-template.handler';
import { UpdateEmailTemplateHandler } from '../../modules/comms/email-templates/update-email-template.handler';
import { ListConversationsHandler } from '../../modules/comms/chat/list-conversations.handler';
import { ListMessagesHandler } from '../../modules/comms/chat/list-messages.handler';

// ── Notification DTOs ─────────────────────────────────────────────────────────

export class ListNotificationsQuery {
  @IsString() recipientId!: string;
  @IsOptional() @IsBoolean() @Type(() => Boolean) unreadOnly?: boolean;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) page?: number;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) limit?: number;
}

export class MarkReadBody {
  @IsString() recipientId!: string;
  @IsOptional() @IsUUID() notificationId?: string;
}

// ── Email Template DTOs ───────────────────────────────────────────────────────

export class ListEmailTemplatesQuery {
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) page?: number;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) limit?: number;
}

export class CreateEmailTemplateBody {
  @IsString() slug!: string;
  @IsString() nameAr!: string;
  @IsOptional() @IsString() nameEn?: string;
  @IsString() subjectAr!: string;
  @IsOptional() @IsString() subjectEn?: string;
  @IsString() htmlBody!: string;
}

export class UpdateEmailTemplateBody {
  @IsOptional() @IsString() nameAr?: string;
  @IsOptional() @IsString() nameEn?: string;
  @IsOptional() @IsString() subjectAr?: string;
  @IsOptional() @IsString() subjectEn?: string;
  @IsOptional() @IsString() htmlBody?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

// ── Chat DTOs ─────────────────────────────────────────────────────────────────

export class ListConversationsQuery {
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsUUID() employeeId?: string;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) page?: number;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) limit?: number;
}

export class ListMessagesQuery {
  @IsOptional() @IsUUID() cursor?: string;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) limit?: number;
}

// ── Controller ────────────────────────────────────────────────────────────────

@Controller('dashboard/comms')
@UseGuards(JwtGuard, CaslGuard)
export class DashboardCommsController {
  constructor(
    private readonly listNotifications: ListNotificationsHandler,
    private readonly markRead: MarkReadHandler,
    private readonly listEmailTemplates: ListEmailTemplatesHandler,
    private readonly getEmailTemplate: GetEmailTemplateHandler,
    private readonly createEmailTemplate: CreateEmailTemplateHandler,
    private readonly updateEmailTemplate: UpdateEmailTemplateHandler,
    private readonly listConversations: ListConversationsHandler,
    private readonly listMessages: ListMessagesHandler,
  ) {}

  // ── Notifications ──────────────────────────────────────────────────────────

  @Get('notifications')
  listNotificationsEndpoint(
    @TenantId() tenantId: string,
    @Query() query: ListNotificationsQuery,
  ) {
    return this.listNotifications.execute({
      tenantId,
      recipientId: query.recipientId,
      unreadOnly: query.unreadOnly,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @Patch('notifications/mark-read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markReadEndpoint(@TenantId() tenantId: string, @Body() body: MarkReadBody) {
    return this.markRead.execute({
      tenantId,
      recipientId: body.recipientId,
      notificationId: body.notificationId,
    });
  }

  // ── Email Templates ────────────────────────────────────────────────────────

  @Get('email-templates')
  listEmailTemplatesEndpoint(
    @TenantId() tenantId: string,
    @Query() query: ListEmailTemplatesQuery,
  ) {
    return this.listEmailTemplates.execute({
      tenantId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @Post('email-templates')
  @HttpCode(HttpStatus.CREATED)
  createEmailTemplateEndpoint(
    @TenantId() tenantId: string,
    @Body() body: CreateEmailTemplateBody,
  ) {
    return this.createEmailTemplate.execute({ tenantId, ...body });
  }

  @Get('email-templates/:id')
  getEmailTemplateEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.getEmailTemplate.execute({ tenantId, id });
  }

  @Patch('email-templates/:id')
  updateEmailTemplateEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateEmailTemplateBody,
  ) {
    return this.updateEmailTemplate.execute({ tenantId, id, ...body });
  }

  // ── Chat ───────────────────────────────────────────────────────────────────

  @Get('chat/conversations')
  listConversationsEndpoint(
    @TenantId() tenantId: string,
    @Query() query: ListConversationsQuery,
  ) {
    return this.listConversations.execute({
      tenantId,
      clientId: query.clientId,
      employeeId: query.employeeId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @Get('chat/conversations/:id/messages')
  listMessagesEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListMessagesQuery,
  ) {
    return this.listMessages.execute({
      tenantId,
      conversationId: id,
      cursor: query.cursor,
      limit: query.limit ?? 20,
    });
  }
}
