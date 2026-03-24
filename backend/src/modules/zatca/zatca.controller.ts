import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { CheckPermissions } from '../auth/decorators/check-permissions.decorator.js';
import { ZatcaService } from './zatca.service.js';
import { ZatcaSandboxService } from './services/zatca-sandbox.service.js';
import { ZatcaOnboardingService } from './services/zatca-onboarding.service.js';
import { ZatcaOnboardDto } from './dto/zatca-onboard.dto.js';
import { uuidPipe } from '../../common/pipes/uuid.pipe.js';

@ApiTags('ZATCA')
@ApiBearerAuth()
@Controller('zatca')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ZatcaController {
  constructor(
    private readonly zatcaService: ZatcaService,
    private readonly sandboxService: ZatcaSandboxService,
    private readonly onboardingService: ZatcaOnboardingService,
  ) {}

  // ── Config ─────────────────────────────────────────────────

  @Get('config')
  @CheckPermissions({ module: 'whitelabel', action: 'view' })
  @ApiOperation({ summary: 'Get current ZATCA configuration' })
  getConfig() {
    return this.zatcaService.loadConfig();
  }

  // ── Onboarding ─────────────────────────────────────────────

  @Post('onboard')
  @CheckPermissions({ module: 'whitelabel', action: 'edit' })
  @ApiOperation({
    summary: 'Start ZATCA Phase 2 onboarding with OTP from Fatoora portal',
  })
  onboard(@Body() dto: ZatcaOnboardDto) {
    return this.onboardingService.onboard(dto.otp);
  }

  @Get('onboarding/status')
  @CheckPermissions({ module: 'whitelabel', action: 'view' })
  @ApiOperation({ summary: 'Get ZATCA onboarding status and credentials state' })
  getOnboardingStatus() {
    return this.onboardingService.getOnboardingStatus();
  }

  // ── Sandbox ────────────────────────────────────────────────

  @Get('sandbox/stats')
  @CheckPermissions({ module: 'invoices', action: 'view' })
  @ApiOperation({ summary: 'Get ZATCA sandbox reporting statistics' })
  getSandboxStats() {
    return this.sandboxService.getSandboxStats();
  }

  @Post('sandbox/report/:invoiceId')
  @CheckPermissions({ module: 'invoices', action: 'edit' })
  @ApiOperation({ summary: 'Report an invoice to ZATCA sandbox for compliance testing' })
  @ApiParam({ name: 'invoiceId', description: 'Invoice UUID' })
  reportToSandbox(@Param('invoiceId', uuidPipe) invoiceId: string) {
    return this.sandboxService.reportInvoiceToSandbox(invoiceId);
  }
}
