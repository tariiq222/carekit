import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { BookingSettingsService } from './booking-settings.service.js';
import { UpdateBookingSettingsDto } from './dto/update-booking-settings.dto.js';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';

@ApiTags('Booking Settings')
@ApiBearerAuth()
@Controller('booking-settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BookingSettingsController {
  constructor(
    private readonly bookingSettingsService: BookingSettingsService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  //  GET /booking-settings — Retrieve current settings
  // ═══════════════════════════════════════════════════════════════

  @Get()
  @CheckPermissions({ module: 'bookings', action: 'view' })
  @ApiOperation({ summary: 'Get booking flow configuration' })
  @ApiResponse({ status: 200 })
  @ApiStandardResponses()
  async get() {
    const data = await this.bookingSettingsService.get();
    return { success: true, data };
  }

  // ═══════════════════════════════════════════════════════════════
  //  PATCH /booking-settings — Update settings
  // ═══════════════════════════════════════════════════════════════

  @Patch()
  @CheckPermissions({ module: 'whitelabel', action: 'edit' })
  @ApiOperation({ summary: 'Update booking flow configuration' })
  @ApiResponse({ status: 200 })
  @ApiStandardResponses()
  async update(@Body() dto: UpdateBookingSettingsDto) {
    const data = await this.bookingSettingsService.update(dto);
    return { success: true, data };
  }
}
