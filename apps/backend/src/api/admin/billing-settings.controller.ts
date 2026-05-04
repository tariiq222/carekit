import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse, ApiParam } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger';
import { AdminHostGuard } from '../../common/guards/admin-host.guard';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { SuperAdminContextInterceptor } from '../../common/interceptors/super-admin-context.interceptor';
import { CurrentUser, JwtUser } from '../../common/auth/current-user.decorator';
import { PlatformSettingsService } from '../../modules/platform/settings/platform-settings.service';
import { UpdateBillingSettingValueDto } from './dto/update-billing-setting-value.dto';

const SECRET_KEYS = new Set([
  'billing.moyasar.platformSecretKey',
  'billing.moyasar.platformWebhookSecret',
]);

const ALL_BILLING_KEYS = [
  'billing.moyasar.platformSecretKey',
  'billing.moyasar.platformWebhookSecret',
  'billing.moyasar.publicKey',
  'billing.defaults.currency',
  'billing.defaults.taxPercent',
  'billing.defaults.trialDays',
] as const;

@ApiTags('Admin / Billing Settings')
@ApiBearerAuth()
@ApiStandardResponses()
@Controller('admin/settings/billing')
@UseGuards(AdminHostGuard, JwtGuard, SuperAdminGuard)
@UseInterceptors(SuperAdminContextInterceptor)
export class BillingSettingsController {
  constructor(private readonly platformSettings: PlatformSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'List all billing settings' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        settings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string' },
              value: { type: 'string' },
              isSecret: { type: 'boolean' },
            },
          },
        },
      },
    },
  })
  async getAllSettings() {
    const entries = await Promise.all(
      ALL_BILLING_KEYS.map(async (key) => {
        const value = await this.platformSettings.get<unknown>(key);
        return {
          key,
          value: SECRET_KEYS.has(key) && value ? '***' : value,
          isSecret: SECRET_KEYS.has(key),
        };
      }),
    );
    return { settings: entries };
  }

  @Patch(':key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a billing setting value' })
  @ApiParam({ name: 'key', type: String })
  @ApiOkResponse({ schema: { type: 'object', properties: { updated: { type: 'boolean' } } } })
  async updateSetting(
    @Param('key') key: string,
    @Body() body: UpdateBillingSettingValueDto,
    @CurrentUser() user: JwtUser,
  ) {
    if (!ALL_BILLING_KEYS.includes(key as (typeof ALL_BILLING_KEYS)[number])) {
      throw new BadRequestException(`Unknown billing settings key: ${key}`);
    }
    await this.platformSettings.set(key, body.value, user.sub, SECRET_KEYS.has(key));
    return { updated: true };
  }

  @Post('test-connection')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test Moyasar connection with current credentials' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        latencyMs: { type: 'number' },
        statusCode: { type: 'number', nullable: true },
        error: { type: 'string', nullable: true },
      },
    },
  })
  async testMoyasarConnection() {
    const secretKey = await this.platformSettings.get<string>('billing.moyasar.platformSecretKey', 'MOYASAR_PLATFORM_SECRET_KEY');
    if (!secretKey) {
      return { ok: false, error: 'No platform secret key configured', latencyMs: 0 };
    }
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch('https://api.moyasar.com/v1/payments?per_page=1', {
        headers: { Authorization: `Basic ${Buffer.from(secretKey + ':').toString('base64')}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return { ok: res.status !== 401, latencyMs: Date.now() - start, statusCode: res.status };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg.includes('abort') ? 'Request timed out' : msg, latencyMs: Date.now() - start };
    }
  }
}
