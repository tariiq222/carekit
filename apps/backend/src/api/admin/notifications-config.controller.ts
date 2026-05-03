import { Body, Controller, Get, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { AdminHostGuard } from '../../common/guards/admin-host.guard';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { SuperAdminContextInterceptor } from '../../common/interceptors/super-admin-context.interceptor';
import { CurrentUser, JwtUser } from '../../common/auth/current-user.decorator';
import { GetNotificationDefaultsHandler } from '../../modules/platform/notifications-config/get-notification-defaults.handler';
import { UpdateNotificationDefaultsHandler } from '../../modules/platform/notifications-config/update-notification-defaults.handler';
import { UpdateNotificationDefaultsDto } from '../../modules/platform/notifications-config/update-notification-defaults.dto';

@Controller('admin/notifications-config')
@UseGuards(AdminHostGuard, JwtGuard, SuperAdminGuard)
@UseInterceptors(SuperAdminContextInterceptor)
export class AdminNotificationsConfigController {
  constructor(
    private readonly getHandler: GetNotificationDefaultsHandler,
    private readonly updateHandler: UpdateNotificationDefaultsHandler,
  ) {}

  @Get()
  getDefaults() {
    return this.getHandler.execute();
  }

  @Put()
  updateDefaults(@Body() dto: UpdateNotificationDefaultsDto, @CurrentUser() user: JwtUser) {
    return this.updateHandler.execute(dto, user.sub);
  }
}
