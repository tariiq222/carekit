import { Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { TenantId } from '../../../common/tenant/tenant.decorator';
import { CurrentUser, JwtUser } from '../../../common/auth/current-user.decorator';
import { ListNotificationsHandler } from '../../../modules/comms/notifications/list-notifications.handler';
import { MarkReadHandler } from '../../../modules/comms/notifications/mark-read.handler';

export class MobileListNotificationsQuery {
  @IsOptional() @Type(() => Boolean) @IsBoolean() unreadOnly?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

@UseGuards(JwtGuard)
@Controller('mobile/client/notifications')
export class MobileClientNotificationsController {
  constructor(
    private readonly listNotifications: ListNotificationsHandler,
    private readonly markRead: MarkReadHandler,
  ) {}

  @Get()
  listNotificationsEndpoint(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtUser,
    @Query() q: MobileListNotificationsQuery,
  ) {
    return this.listNotifications.execute({
      tenantId,
      recipientId: user.sub,
      unreadOnly: q.unreadOnly,
      page: q.page ?? 1,
      limit: q.limit ?? 20,
    });
  }

  @Patch('mark-read')
  markReadEndpoint(@TenantId() tenantId: string, @CurrentUser() user: JwtUser) {
    return this.markRead.execute({ tenantId, recipientId: user.sub });
  }
}
