import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { CheckPermissions } from '../auth/decorators/check-permissions.decorator.js';
import { ZatcaService } from './zatca.service.js';
import { ZatcaSandboxService } from './services/zatca-sandbox.service.js';

@ApiTags('ZATCA')
@Controller('zatca')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ZatcaController {
  constructor(
    private readonly zatcaService: ZatcaService,
    private readonly sandboxService: ZatcaSandboxService,
  ) {}

  @Get('config')
  @CheckPermissions({ module: 'whitelabel', action: 'view' })
  @ApiOperation({ summary: 'Get current ZATCA configuration' })
  getConfig() {
    return this.zatcaService.loadConfig();
  }

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
  reportToSandbox(@Param('invoiceId') invoiceId: string) {
    return this.sandboxService.reportInvoiceToSandbox(invoiceId);
  }
}
