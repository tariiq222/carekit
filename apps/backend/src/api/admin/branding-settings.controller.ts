import { Body, Controller, Get, HttpCode, HttpStatus, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { AdminHostGuard } from '../../common/guards/admin-host.guard';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { SuperAdminContextInterceptor } from '../../common/interceptors/super-admin-context.interceptor';
import { CurrentUser, JwtUser } from '../../common/auth/current-user.decorator';
import { PlatformSettingsService } from '../../modules/platform/settings/platform-settings.service';

@Controller('admin/settings/brand')
@UseGuards(AdminHostGuard, JwtGuard, SuperAdminGuard)
@UseInterceptors(SuperAdminContextInterceptor)
export class BrandingSettingsController {
  constructor(private readonly settings: PlatformSettingsService) {}

  @Get()
  async getBrand() {
    const [logoUrl, primaryColor, accentColor, locale, rtlDefault, dateFormat, currencyFormat] = await Promise.all([
      this.settings.get<string>('platform.brand.logoUrl'),
      this.settings.get<string>('platform.brand.primaryColor'),
      this.settings.get<string>('platform.brand.accentColor'),
      this.settings.get<string>('platform.locale.default'),
      this.settings.get<boolean>('platform.locale.rtlDefault'),
      this.settings.get<string>('platform.locale.dateFormat'),
      this.settings.get<string>('platform.locale.currencyFormat'),
    ]);
    return {
      logoUrl: logoUrl ?? '',
      primaryColor: primaryColor ?? '#354FD8',
      accentColor: accentColor ?? '#82CC17',
      locale: {
        default: locale ?? 'ar',
        rtlDefault: rtlDefault ?? true,
        dateFormat: dateFormat ?? 'dd/MM/yyyy',
        currencyFormat: currencyFormat ?? 'SAR',
      },
    };
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  async updateBrand(@Body() body: Record<string, unknown>, @CurrentUser() user: JwtUser) {
    const updates: Array<[string, unknown]> = [];
    if ('logoUrl' in body) updates.push(['platform.brand.logoUrl', body.logoUrl]);
    if ('primaryColor' in body) updates.push(['platform.brand.primaryColor', body.primaryColor]);
    if ('accentColor' in body) updates.push(['platform.brand.accentColor', body.accentColor]);
    if (body.locale && typeof body.locale === 'object') {
      const loc = body.locale as Record<string, unknown>;
      if ('default' in loc) updates.push(['platform.locale.default', loc.default]);
      if ('rtlDefault' in loc) updates.push(['platform.locale.rtlDefault', loc.rtlDefault]);
      if ('dateFormat' in loc) updates.push(['platform.locale.dateFormat', loc.dateFormat]);
      if ('currencyFormat' in loc) updates.push(['platform.locale.currencyFormat', loc.currencyFormat]);
    }
    await Promise.all(updates.map(([key, value]) => this.settings.set(key, value, user.sub)));
    return { updated: true };
  }
}
