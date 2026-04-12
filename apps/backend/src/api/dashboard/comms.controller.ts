import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { TenantId } from '../../common/tenant/tenant.decorator';
import { ListNotificationsHandler } from '../../modules/comms/notifications/list-notifications.handler';
import { ListNotificationsDto } from '../../modules/comms/notifications/list-notifications.dto';
import { MarkReadHandler } from '../../modules/comms/notifications/mark-read.handler';
import { MarkReadDto } from '../../modules/comms/notifications/mark-read.dto';
import { ListEmailTemplatesHandler } from '../../modules/comms/email-templates/list-email-templates.handler';
import { ListEmailTemplatesDto } from '../../modules/comms/email-templates/list-email-templates.dto';
import { GetEmailTemplateHandler } from '../../modules/comms/email-templates/get-email-template.handler';
import { CreateEmailTemplateHandler } from '../../modules/comms/email-templates/create-email-template.handler';
import { CreateEmailTemplateDto } from '../../modules/comms/email-templates/create-email-template.dto';
import { UpdateEmailTemplateHandler } from '../../modules/comms/email-templates/update-email-template.handler';
import { UpdateEmailTemplateDto } from '../../modules/comms/email-templates/update-email-template.dto';
import { ListConversationsHandler } from '../../modules/comms/chat/list-conversations.handler';
import { ListConversationsDto } from '../../modules/comms/chat/list-conversations.dto';
import { ListMessagesHandler } from '../../modules/comms/chat/list-messages.handler';
import { ListMessagesDto } from '../../modules/comms/chat/list-messages.dto';

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
    @Query() query: ListNotificationsDto,
  ) {
    return this.listNotifications.execute({
      tenantId,
      ...query,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @Patch('notifications/mark-read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markReadEndpoint(@TenantId() tenantId: string, @Body() body: MarkReadDto) {
    return this.markRead.execute({ tenantId, ...body });
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
}
