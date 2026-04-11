import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { BookingStatusLogService } from './booking-status-log.service.js';
import { uuidPipe } from '../../common/pipes/uuid.pipe.js';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';

@ApiTags('Bookings')
@ApiBearerAuth()
@Controller('bookings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BookingStatusLogController {
  constructor(private readonly statusLogService: BookingStatusLogService) {}

  // ═══════════════════════════════════════════════════════════════
  //  GET /bookings/:id/status-log — Retrieve status audit trail
  // ═══════════════════════════════════════════════════════════════

  @Get(':id/status-log')
  @CheckPermissions({ module: 'bookings', action: 'view' })
  @ApiOperation({ summary: 'Get booking status change audit trail' })
  @ApiParam({ name: 'id', description: 'Booking UUID' })
  @ApiResponse({ status: 200 })
  @ApiStandardResponses()
  async getStatusLog(@Param('id', uuidPipe) id: string) {
    const data = await this.statusLogService.findByBooking(id);
    return { success: true, data };
  }
}
