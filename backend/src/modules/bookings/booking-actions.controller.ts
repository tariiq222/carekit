import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { BookingsService } from './bookings.service.js';
import { CancelRequestDto } from './dto/cancel-request.dto.js';
import { CancelApproveDto } from './dto/cancel-approve.dto.js';
import { CancelRejectDto } from './dto/cancel-reject.dto.js';
import { AdminCancelDto } from './dto/admin-cancel.dto.js';
import { CompleteBookingDto } from './dto/complete-booking.dto.js';
import { uuidPipe } from '../../common/pipes/uuid.pipe.js';

@ApiTags('Bookings')
@ApiBearerAuth()
@Controller('bookings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BookingActionsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // ═══════════════════════════════════════════════════════════════
  //  POST /bookings/:id/confirm
  // ═══════════════════════════════════════════════════════════════

  @Post(':id/confirm')
  @HttpCode(200)
  @CheckPermissions({ module: 'bookings', action: 'edit' })
  @ApiOperation({ summary: 'Confirm a pending booking' })
  async confirm(
    @Param('id', uuidPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.bookingsService.confirm(id, user.id);
  }

  // ═══════════════════════════════════════════════════════════════
  //  POST /bookings/:id/check-in
  // ═══════════════════════════════════════════════════════════════

  @Post(':id/check-in')
  @HttpCode(200)
  @CheckPermissions({ module: 'bookings', action: 'edit' })
  @ApiOperation({ summary: 'Check in a confirmed booking' })
  async checkIn(
    @Param('id', uuidPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.bookingsService.checkIn(id, user.id);
  }

  // ═══════════════════════════════════════════════════════════════
  //  POST /bookings/:id/start — Start Session (practitioner only)
  // ═══════════════════════════════════════════════════════════════

  @Post(':id/start')
  @HttpCode(200)
  @CheckPermissions({ module: 'bookings', action: 'edit' })
  @ApiOperation({ summary: 'Start session for a booking (practitioner only)' })
  async startSession(
    @Param('id', uuidPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.bookingsService.startSession(id, user.id);
  }

  // ═══════════════════════════════════════════════════════════════
  //  POST /bookings/:id/complete
  // ═══════════════════════════════════════════════════════════════

  @Post(':id/complete')
  @HttpCode(200)
  @CheckPermissions({ module: 'bookings', action: 'edit' })
  @ApiOperation({ summary: 'Mark booking as completed' })
  async complete(
    @Param('id', uuidPipe) id: string,
    @Body() dto: CompleteBookingDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.bookingsService.complete(id, dto, user.id);
  }

  // ═══════════════════════════════════════════════════════════════
  //  POST /bookings/:id/no-show
  // ═══════════════════════════════════════════════════════════════

  @Post(':id/no-show')
  @HttpCode(200)
  @CheckPermissions({ module: 'bookings', action: 'edit' })
  @ApiOperation({ summary: 'Mark booking as no-show' })
  async markNoShow(
    @Param('id', uuidPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.bookingsService.markNoShow(id, user.id);
  }

  // ═══════════════════════════════════════════════════════════════
  //  POST /bookings/:id/cancel-request (patient ownership)
  // ═══════════════════════════════════════════════════════════════

  @Post(':id/cancel-request')
  @HttpCode(200)
  @CheckPermissions({ module: 'bookings', action: 'create' })
  @ApiOperation({ summary: 'Request booking cancellation (patient)' })
  async cancelRequest(
    @Param('id', uuidPipe) id: string,
    @Body() dto: CancelRequestDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.bookingsService.requestCancellation(
      id,
      user.id,
      dto.reason,
    );
  }

  // ═══════════════════════════════════════════════════════════════
  //  POST /bookings/:id/cancel/approve
  // ═══════════════════════════════════════════════════════════════

  @Post(':id/cancel/approve')
  @HttpCode(200)
  @CheckPermissions({ module: 'bookings', action: 'edit' })
  @ApiOperation({ summary: 'Approve a pending cancellation request' })
  async cancelApprove(
    @Param('id', uuidPipe) id: string,
    @Body() dto: CancelApproveDto,
  ) {
    return this.bookingsService.approveCancellation(id, dto);
  }

  // ═══════════════════════════════════════════════════════════════
  //  POST /bookings/:id/cancel/reject
  // ═══════════════════════════════════════════════════════════════

  @Post(':id/cancel/reject')
  @HttpCode(200)
  @CheckPermissions({ module: 'bookings', action: 'edit' })
  @ApiOperation({ summary: 'Reject a pending cancellation request' })
  async cancelReject(
    @Param('id', uuidPipe) id: string,
    @Body() dto: CancelRejectDto,
  ) {
    return this.bookingsService.rejectCancellation(id, dto);
  }

  // ═══════════════════════════════════════════════════════════════
  //  POST /bookings/:id/admin-cancel — Admin direct cancel
  // ═══════════════════════════════════════════════════════════════

  @Post(':id/admin-cancel')
  @HttpCode(200)
  @CheckPermissions({ module: 'bookings', action: 'delete' })
  @ApiOperation({ summary: 'Admin direct cancel a booking' })
  async adminCancel(
    @Param('id', uuidPipe) id: string,
    @Body() dto: AdminCancelDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.bookingsService.adminDirectCancel(id, user.id, dto);
  }

  // ═══════════════════════════════════════════════════════════════
  //  POST /bookings/:id/practitioner-cancel — Practitioner cancel
  // ═══════════════════════════════════════════════════════════════

  @Post(':id/practitioner-cancel')
  @HttpCode(200)
  @CheckPermissions({ module: 'bookings', action: 'delete' })
  @ApiOperation({ summary: 'Cancel a booking (practitioner)' })
  async practitionerCancel(
    @Param('id', uuidPipe) id: string,
    @Body() dto: CancelRequestDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.bookingsService.practitionerCancel(id, user.id, dto.reason);
  }
}
