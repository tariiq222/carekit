import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser, JwtUser } from '../../common/auth/current-user.decorator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { TenantId } from '../../common/tenant/tenant.decorator';
import { ListNotificationsHandler } from '../../modules/comms/notifications/list-notifications.handler';
import { ListNotificationsDto } from '../../modules/comms/notifications/list-notifications.dto';
import { GetUnreadCountHandler } from '../../modules/comms/notifications/get-unread-count.handler';
import { MarkReadHandler } from '../../modules/comms/notifications/mark-read.handler';
import { MarkReadDto } from '../../modules/comms/notifications/mark-read.dto';
import { ListEmailTemplatesHandler } from '../../modules/comms/email-templates/list-email-templates.handler';
import { ListEmailTemplatesDto } from '../../modules/comms/email-templates/list-email-templates.dto';
import { GetEmailTemplateHandler } from '../../modules/comms/email-templates/get-email-template.handler';
import { CreateEmailTemplateHandler } from '../../modules/comms/email-templates/create-email-template.handler';
import { CreateEmailTemplateDto } from '../../modules/comms/email-templates/create-email-template.dto';
import { UpdateEmailTemplateHandler } from '../../modules/comms/email-templates/update-email-template.handler';
import { UpdateEmailTemplateDto } from '../../modules/comms/email-templates/update-email-template.dto';
import { PreviewEmailTemplateHandler } from '../../modules/comms/email-templates/preview-email-template.handler';
import { PreviewEmailTemplateDto } from '../../modules/comms/email-templates/preview-email-template.dto';
import { ListConversationsHandler } from '../../modules/comms/chat/list-conversations.handler';
import { ListConversationsDto } from '../../modules/comms/chat/list-conversations.dto';
import { ListMessagesHandler } from '../../modules/comms/chat/list-messages.handler';
import { ListMessagesDto } from '../../modules/comms/chat/list-messages.dto';
import { GetConversationHandler } from '../../modules/comms/chat/get-conversation.handler';
import { CloseConversationHandler } from '../../modules/comms/chat/close-conversation.handler';
import { SendStaffMessageHandler } from '../../modules/comms/chat/send-staff-message.handler';
import { SendStaffMessageDto } from '../../modules/comms/chat/send-staff-message.dto';

@ApiTags('Comms')
@ApiBearerAuth()
@Controller('dashboard/comms')
@UseGuards(JwtGuard, CaslGuard)
export class DashboardCommsController {
  constructor(
    private readonly listNotifications: ListNotificationsHandler,
    private readonly getUnreadCount: GetUnreadCountHandler,
    private readonly markRead: MarkReadHandler,
    private readonly listEmailTemplates: ListEmailTemplatesHandler,
    private readonly getEmailTemplate: GetEmailTemplateHandler,
    private readonly createEmailTemplate: CreateEmailTemplateHandler,
    private readonly updateEmailTemplate: UpdateEmailTemplateHandler,
    private readonly previewEmailTemplate: PreviewEmailTemplateHandler,
    private readonly listConversations: ListConversationsHandler,
    private readonly listMessages: ListMessagesHandler,
    private readonly getConversation: GetConversationHandler,
    private readonly closeConversation: CloseConversationHandler,
    private readonly sendStaffMessage: SendStaffMessageHandler,
  ) {}

  // ── Notifications ──────────────────────────────────────────────────────────

  @Get('notifications')
  listNotificationsEndpoint(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtUser,
    @Query() query: ListNotificationsDto,
  ) {
    return this.listNotifications.execute({
      tenantId,
      recipientId: user.sub,
      unreadOnly: query.unreadOnly,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @Get('notifications/unread-count')
  getUnreadCountEndpoint(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.getUnreadCount.execute({ tenantId, recipientId: user.sub });
  }

  @Patch('notifications/mark-read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markReadEndpoint(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtUser,
    @Body() body: MarkReadDto = {},
  ) {
    return this.markRead.execute({ tenantId, recipientId: user.sub, ...body });
  }

  // ── Email Templates ────────────────────────────────────────────────────────

  @Get('email-templates')
  listEmailTemplatesEndpoint(
    @TenantId() tenantId: string,
    @Query() query: ListEmailTemplatesDto,
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
    @Body() body: CreateEmailTemplateDto,
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

  @Post('email-templates/:id/preview')
  @HttpCode(HttpStatus.OK)
  previewEmailTemplateEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PreviewEmailTemplateDto,
  ) {
    return this.previewEmailTemplate.execute({
      tenantId,
      id,
      lang: body.lang,
      context: body.context ?? {},
    });
  }

  @Patch('email-templates/:id')
  updateEmailTemplateEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateEmailTemplateDto,
  ) {
    return this.updateEmailTemplate.execute({ tenantId, id, ...body });
  }

  // ── Chat ───────────────────────────────────────────────────────────────────

  @Get('chat/conversations')
  listConversationsEndpoint(
    @TenantId() tenantId: string,
    @Query() query: ListConversationsDto,
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
    @Query() query: ListMessagesDto,
  ) {
    return this.listMessages.execute({
      tenantId,
      conversationId: id,
      cursor: query.cursor,
      limit: query.limit ?? 20,
    });
  }

  @Get('chat/conversations/:id')
  getConversationEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.getConversation.execute({ tenantId, conversationId: id });
  }

  @Patch('chat/conversations/:id/close')
  @HttpCode(HttpStatus.OK)
  closeConversationEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.closeConversation.execute({ tenantId, conversationId: id });
  }

  @Post('chat/conversations/:id/messages')
  @HttpCode(HttpStatus.CREATED)
  sendStaffMessageEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SendStaffMessageDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.sendStaffMessage.execute({
      tenantId,
      conversationId: id,
      staffId: user.sub,
      body: body.body,
    });
  }
}
