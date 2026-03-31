import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { ClinicSettingsService } from './clinic-settings.service.js';
import { UpdateBookingFlowOrderDto } from './dto/update-booking-flow-order.dto.js';

@ApiTags('Clinic')
@Controller('clinic/settings')
export class ClinicSettingsController {
  constructor(private readonly clinicSettingsService: ClinicSettingsService) {}

  @Get('public')
  async getPublicSettings() {
    const data = await this.clinicSettingsService.getPublicSettings();
    return { success: true, data };
  }

  @Get('booking-flow')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @CheckPermissions({ module: 'whitelabel', action: 'view' })
  async getBookingFlowOrder() {
    const order = await this.clinicSettingsService.getBookingFlowOrder();
    return { success: true, data: { bookingFlowOrder: order } };
  }

  @Patch('booking-flow')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @CheckPermissions({ module: 'whitelabel', action: 'edit' })
  async updateBookingFlowOrder(@Body() dto: UpdateBookingFlowOrderDto) {
    const order = await this.clinicSettingsService.updateBookingFlowOrder(dto.order);
    return { success: true, data: { bookingFlowOrder: order } };
  }
}
