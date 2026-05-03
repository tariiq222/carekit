import { Body, Controller, Get, HttpCode, HttpStatus, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { AdminHostGuard } from '../../common/guards/admin-host.guard';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { SuperAdminContextInterceptor } from '../../common/interceptors/super-admin-context.interceptor';
import { CurrentUser, JwtUser } from '../../common/auth/current-user.decorator';
import { PlatformSettingsService } from '../../modules/platform/settings/platform-settings.service';

interface SecuritySettings {
  sessionTtlMinutes: number;
  require2fa: boolean;
  ipAllowlist: string[];
}

@Controller('admin/settings/security')
@UseGuards(AdminHostGuard, JwtGuard, SuperAdminGuard)
@UseInterceptors(SuperAdminContextInterceptor)
export class SecuritySettingsController {
  constructor(private readonly settings: PlatformSettingsService) {}

  @Get()
  async getSettings(): Promise<SecuritySettings> {
    const [ttl, require2fa, ipAllowlist] = await Promise.all([
      this.settings.get<number>('security.session.superAdminTtlMinutes'),
      this.settings.get<boolean>('security.twoFactor.required'),
      this.settings.get<string[]>('security.ipAllowlist'),
    ]);
    return {
      sessionTtlMinutes: ttl ?? 60,
      require2fa: require2fa ?? false,
      ipAllowlist: ipAllowlist ?? [],
    };
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  async updateSettings(@Body() body: Partial<SecuritySettings>, @CurrentUser() user: JwtUser) {
    const updates: Array<[string, unknown]> = [];
    if (body.sessionTtlMinutes !== undefined) updates.push(['security.session.superAdminTtlMinutes', body.sessionTtlMinutes]);
    if (body.require2fa !== undefined) updates.push(['security.twoFactor.required', body.require2fa]);
    if (body.ipAllowlist !== undefined) updates.push(['security.ipAllowlist', body.ipAllowlist]);
    await Promise.all(updates.map(([key, value]) => this.settings.set(key, value, user.sub)));
    return { updated: true };
  }
}
