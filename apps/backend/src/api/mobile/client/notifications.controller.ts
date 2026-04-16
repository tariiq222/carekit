import { Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags, ApiBearerAuth, ApiOperation,
  ApiOkResponse, ApiNoContentResponse,
} from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { CurrentUser, JwtUser } from '../../../common/auth/current-user.decorator';
import { ApiStandardResponses } from '../../../common/swagger';
import { ListNotificationsHandler } from '../../../modules/comms/notifications/list-notifications.handler';
import { MarkReadHandler } from '../../../modules/comms/notifications/mark-read.handler';

export class MobileListNotificationsQuery {
  @ApiPropertyOptional({ description: 'Return only unread notifications', example: true })
  @IsOptional() @Type(() => Boolean) @IsBoolean() unreadOnly?: boolean;

  @ApiPropertyOptional({ description: 'Page number (1-based)', example: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;

  @ApiPropertyOptional({ description: 'Number of results per page', example: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

@ApiTags('Mobile Client / Notifications')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(JwtGuard)
@Controller('mobile/client/notifications')
export class MobileClientNotificationsController {
  constructor(
    private readonly listNotifications: ListNotificationsHandler,
    private readonly markRead: MarkReadHandler,
  ) {}

  @ApiOperation({ summary: 'List notifications for the current client' })
  @ApiOkResponse({ description: 'Paginated notification list' })
  @Get()
  listNotificationsEndpoint(
    @CurrentUser() user: JwtUser,
    @Query() q: MobileListNotificationsQuery,
  ) {
    return this.listNotifications.execute({
      recipientId: user.sub,
      unreadOnly: q.unreadOnly,
      page: q.page ?? 1,
      limit: q.limit ?? 20,
    });
  }

  @ApiOperation({ summary: 'Mark all notifications as read for the current client' })
  @ApiNoContentResponse({ description: 'All notifications marked as read' })
  @Patch('mark-read')
  markReadEndpoint(@CurrentUser() user: JwtUser) {
    return this.markRead.execute({ recipientId: user.sub });
  }
}
