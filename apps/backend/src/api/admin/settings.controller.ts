import { Body, Controller, Get, Param, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse, ApiNotFoundResponse, ApiParam } from '@nestjs/swagger';
import { AdminHostGuard } from '../../common/guards/admin-host.guard';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { SuperAdminContextInterceptor } from '../../common/interceptors/super-admin-context.interceptor';
import { CurrentUser, JwtUser } from '../../common/auth/current-user.decorator';
import { ApiStandardResponses } from '../../common/swagger';
import { GetPlatformSettingHandler } from '../../modules/platform/settings/get-platform-setting/get-platform-setting.handler';
import { UpsertPlatformSettingHandler } from '../../modules/platform/settings/upsert-platform-setting/upsert-platform-setting.handler';
import { UpsertPlatformSettingDto } from '../../modules/platform/settings/upsert-platform-setting/upsert-platform-setting.dto';

@ApiTags('Admin / Platform Settings')
@ApiBearerAuth()
@ApiStandardResponses()
@Controller('admin/settings')
@UseGuards(AdminHostGuard, JwtGuard, SuperAdminGuard)
@UseInterceptors(SuperAdminContextInterceptor)
export class AdminSettingsController {
  constructor(
    private readonly getSetting: GetPlatformSettingHandler,
    private readonly upsertSetting: UpsertPlatformSettingHandler,
  ) {}

  @Get(':key')
  @ApiOperation({ summary: 'Get platform setting by key' })
  @ApiParam({ name: 'key', type: String })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { key: { type: 'string' }, value: { type: 'string' } },
      nullable: true,
    },
  })
  @ApiNotFoundResponse({ description: 'Setting not found' })
  getSettingByKey(@Param('key') key: string) {
    return this.getSetting.execute(key);
  }

  @Put()
  @ApiOperation({ summary: 'Upsert a platform setting value' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        key: { type: 'string' },
        value: { type: 'string' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  upsertSettingValue(@Body() dto: UpsertPlatformSettingDto, @CurrentUser() user: JwtUser) {
    return this.upsertSetting.execute(dto, user.sub);
  }
}
