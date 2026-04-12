import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { TenantId } from '../../../common/tenant/tenant.decorator';
import { CurrentUser, JwtUser } from '../../../common/auth/current-user.decorator';
import { ChatCompletionHandler } from '../../../modules/ai/chat-completion/chat-completion.handler';
import { ListConversationsHandler } from '../../../modules/comms/chat/list-conversations.handler';
import { ListMessagesHandler } from '../../../modules/comms/chat/list-messages.handler';

export class MobileChatBody {
  @IsString() userMessage!: string;
  @IsOptional() @IsUUID() sessionId?: string;
}

export class MobileListConversationsQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

export class MobileListMessagesQuery {
  @IsOptional() @IsUUID() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

@UseGuards(JwtGuard)
@Controller('mobile/client/chat')
export class MobileClientChatController {
  constructor(
    private readonly chatCompletion: ChatCompletionHandler,
    private readonly listConversations: ListConversationsHandler,
    private readonly listMessages: ListMessagesHandler,
  ) {}

  @Post()
  chat(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtUser,
    @Body() body: MobileChatBody,
  ) {
    return this.chatCompletion.execute({
      tenantId,
      clientId: user.sub,
      userMessage: body.userMessage,
      sessionId: body.sessionId,
    });
  }

  @Get('conversations')
  listConversationsEndpoint(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtUser,
    @Query() q: MobileListConversationsQuery,
  ) {
    return this.listConversations.execute({
      tenantId,
      clientId: user.sub,
      page: q.page ?? 1,
      limit: q.limit ?? 20,
    });
  }

  @Get('conversations/:id/messages')
  listMessagesEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: MobileListMessagesQuery,
  ) {
    return this.listMessages.execute({
      tenantId,
      conversationId: id,
      cursor: q.cursor,
      limit: q.limit ?? 30,
    });
  }
}
