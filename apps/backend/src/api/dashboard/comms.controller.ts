import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiParam,
  ApiOkResponse, ApiCreatedResponse, ApiNoContentResponse,
} from '@nestjs/swagger';
import { CurrentUser, JwtUser } from '../../common/auth/current-user.decorator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { ApiStandardResponses } from '../../common/swagger';
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
import { ListContactMessagesHandler } from '../../modules/comms/contact-messages/list-contact-messages.handler';
import { ListContactMessagesDto } from '../../modules/comms/contact-messages/list-contact-messages.dto';
import { UpdateContactMessageStatusHandler } from '../../modules/comms/contact-messages/update-contact-message-status.handler';
import { UpdateContactMessageStatusDto } from '../../modules/comms/contact-messages/update-contact-message-status.dto';

@ApiTags('Dashboard / Comms')
@ApiBearerAuth()
@ApiStandardResponses()
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
    private readonly listContactMessages: ListContactMessagesHandler,
    private readonly updateContactMessageStatus: UpdateContactMessageStatusHandler,
  ) {}

  // ── Contact Messages ───────────────────────────────────────────────────────

  @ApiOperation({ summary: 'List contact messages' })
  @ApiOkResponse({ description: 'Paginated contact messages' })
  @Get('contact-messages')
  listContactMessagesEndpoint(@Query() query: ListContactMessagesDto) {
    return this.listContactMessages.execute({
      status: query.status,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @ApiOperation({ summary: 'Update contact message status' })
  @ApiParam({ name: 'id', description: 'Contact message UUID' })
  @ApiOkResponse({ description: 'Updated message' })
  @Patch('contact-messages/:id/status')
  updateContactMessageStatusEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContactMessageStatusDto,
  ) {
    return this.updateContactMessageStatus.execute({ id, status: dto.status });
  }

  // ── Notifications ──────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'List notifications for the current staff user' })
  @ApiOkResponse({ description: 'Paginated notification list' })
  @Get('notifications')
  listNotificationsEndpoint(
    @CurrentUser() user: JwtUser,
    @Query() query: ListNotificationsDto,
  ) {
    return this.listNotifications.execute({
      recipientId: user.sub,
      unreadOnly: query.unreadOnly,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @ApiOperation({ summary: 'Get unread notification count for the current staff user' })
  @ApiOkResponse({ description: 'Unread count value' })
  @Get('notifications/unread-count')
  getUnreadCountEndpoint(
    @CurrentUser() user: JwtUser,
  ) {
    return this.getUnreadCount.execute({ recipientId: user.sub });
  }

  @ApiOperation({ summary: 'Mark notifications as read (all or a single one)' })
  @ApiNoContentResponse({ description: 'Notifications marked as read' })
  @Patch('notifications/mark-read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markReadEndpoint(
    @CurrentUser() user: JwtUser,
    @Body() body: MarkReadDto = {},
  ) {
    return this.markRead.execute({ recipientId: user.sub, ...body });
  }

  // ── Email Templates ────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'List email templates' })
  @ApiOkResponse({ description: 'Paginated email template list' })
  @Get('email-templates')
  listEmailTemplatesEndpoint(
    @Query() query: ListEmailTemplatesDto,
  ) {
    return this.listEmailTemplates.execute({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @ApiOperation({ summary: 'Create an email template' })
  @ApiCreatedResponse({ description: 'Email template created' })
  @Post('email-templates')
  @HttpCode(HttpStatus.CREATED)
  createEmailTemplateEndpoint(
    @Body() body: CreateEmailTemplateDto,
  ) {
    return this.createEmailTemplate.execute({ ...body });
  }

  @ApiOperation({ summary: 'Get a single email template by ID' })
  @ApiOkResponse({ description: 'Email template details' })
  @ApiParam({ name: 'id', description: 'Email template UUID', example: '00000000-0000-0000-0000-000000000000' })
  @Get('email-templates/:id')
  getEmailTemplateEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.getEmailTemplate.execute({ id });
  }

  @ApiOperation({ summary: 'Preview a rendered email template' })
  @ApiOkResponse({ description: 'Rendered HTML preview' })
  @ApiParam({ name: 'id', description: 'Email template UUID', example: '00000000-0000-0000-0000-000000000000' })
  @Post('email-templates/:id/preview')
  @HttpCode(HttpStatus.OK)
  previewEmailTemplateEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PreviewEmailTemplateDto,
  ) {
    return this.previewEmailTemplate.execute({
      id,
      lang: body.lang,
      context: body.context ?? {},
    });
  }

  @ApiOperation({ summary: 'Update an email template' })
  @ApiOkResponse({ description: 'Updated email template' })
  @ApiParam({ name: 'id', description: 'Email template UUID', example: '00000000-0000-0000-0000-000000000000' })
  @Patch('email-templates/:id')
  updateEmailTemplateEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateEmailTemplateDto,
  ) {
    return this.updateEmailTemplate.execute({ id, ...body });
  }

  // ── Chat ───────────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'List chat conversations' })
  @ApiOkResponse({ description: 'Paginated conversation list' })
  @Get('chat/conversations')
  listConversationsEndpoint(
    @Query() query: ListConversationsDto,
  ) {
    return this.listConversations.execute({
      clientId: query.clientId,
      employeeId: query.employeeId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @ApiOperation({ summary: 'List messages in a conversation' })
  @ApiOkResponse({ description: 'Cursor-paginated message list' })
  @ApiParam({ name: 'id', description: 'Conversation UUID', example: '00000000-0000-0000-0000-000000000000' })
  @Get('chat/conversations/:id/messages')
  listMessagesEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListMessagesDto,
  ) {
    return this.listMessages.execute({
      conversationId: id,
      cursor: query.cursor,
      limit: query.limit ?? 20,
    });
  }

  @ApiOperation({ summary: 'Get a single conversation by ID' })
  @ApiOkResponse({ description: 'Conversation details' })
  @ApiParam({ name: 'id', description: 'Conversation UUID', example: '00000000-0000-0000-0000-000000000000' })
  @Get('chat/conversations/:id')
  getConversationEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.getConversation.execute({ conversationId: id });
  }

  @ApiOperation({ summary: 'Close a conversation' })
  @ApiOkResponse({ description: 'Conversation closed' })
  @ApiParam({ name: 'id', description: 'Conversation UUID', example: '00000000-0000-0000-0000-000000000000' })
  @Patch('chat/conversations/:id/close')
  @HttpCode(HttpStatus.OK)
  closeConversationEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.closeConversation.execute({ conversationId: id });
  }

  @ApiOperation({ summary: 'Send a staff message in a conversation' })
  @ApiCreatedResponse({ description: 'Message sent' })
  @ApiParam({ name: 'id', description: 'Conversation UUID', example: '00000000-0000-0000-0000-000000000000' })
  @Post('chat/conversations/:id/messages')
  @HttpCode(HttpStatus.CREATED)
  sendStaffMessageEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SendStaffMessageDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.sendStaffMessage.execute({
      conversationId: id,
      staffId: user.sub,
      body: body.body,
    });
  }
}
