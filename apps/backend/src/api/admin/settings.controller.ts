import { Body, Controller, Get, Param, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { AdminHostGuard } from '../../common/guards/admin-host.guard';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { SuperAdminContextInterceptor } from '../../common/interceptors/super-admin-context.interceptor';
import { CurrentUser, JwtUser } from '../../common/auth/current-user.decorator';
import { GetPlatformSettingHandler } from '../../modules/platform/settings/get-platform-setting/get-platform-setting.handler';
import { UpsertPlatformSettingHandler } from '../../modules/platform/settings/upsert-platform-setting/upsert-platform-setting.handler';
import { UpsertPlatformSettingDto } from '../../modules/platform/settings/upsert-platform-setting/upsert-platform-setting.dto';

@Controller('admin/settings')
@UseGuards(AdminHostGuard, JwtGuard, SuperAdminGuard)
@UseInterceptors(SuperAdminContextInterceptor)
export class AdminSettingsController {
  constructor(
    private readonly getSetting: GetPlatformSettingHandler,
    private readonly upsertSetting: UpsertPlatformSettingHandler,
  ) {}

  @Get(':key')
  getSettingByKey(@Param('key') key: string) {
    return this.getSetting.execute(key);
  }

  @Put()
  upsertSettingValue(@Body() dto: UpsertPlatformSettingDto, @CurrentUser() user: JwtUser) {
    return this.upsertSetting.execute(dto, user.sub);
  }
}
