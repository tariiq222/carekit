import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { THROTTLE_LIMIT, THROTTLE_TTL } from '../../config/constants.js';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { BookingsService } from './bookings.service.js';
import { BookingRecurringService } from './booking-recurring.service.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { CreateRecurringBookingDto } from './dto/create-recurring-booking.dto.js';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto.js';
import { CancelRequestDto } from './dto/cancel-request.dto.js';
import { CancelApproveDto } from './dto/cancel-approve.dto.js';
import { CancelRejectDto } from './dto/cancel-reject.dto.js';
import { AdminCancelDto } from './dto/admin-cancel.dto.js';
import { CompleteBookingDto } from './dto/complete-booking.dto.js';
import { BookingListQueryDto } from './dto/booking-list-query.dto.js';
import { uuidPipe } from '../../common/pipes/uuid.pipe.js';
import type { UserPayload } from '../../common/types/user-payload.type.js';

@ApiTags('Bookings')
@ApiBearerAuth()
@Controller('bookings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly bookingRecurringService: BookingRecurringService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  //  POST /bookings — Create Booking
  // ═══════════════════════════════════════════════════════════════

  @Post()
  @Throttle({ default: { limit: THROTTLE_LIMIT, ttl: THROTTLE_TTL } })
  @CheckPermissions({ module: 'bookings', action: 'create' })
  async create(
    @Body() dto: CreateBookingDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.bookingsService.create(user.id, dto, user.roles);
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET /bookings/my — Patient's Own Bookings (must be before :id)
  // ═══════════════════════════════════════════════════════════════

  @Get('my')
  @CheckPermissions({ module: 'bookings', action: 'view' })
  async findMyBookings(@CurrentUser() user: { id: string }) {
    return this.bookingsService.findMyBookings(user.id);
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET /bookings/today — Practitioner's Today Bookings
  // ═══════════════════════════════════════════════════════════════

  @Get('today')
  @CheckPermissions({ module: 'bookings', action: 'view' })
  async findTodayBookings(@CurrentUser() user: { id: string }) {
    return this.bookingsService.findTodayBookingsForUser(user.id);
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET /bookings/stats — Booking Statistics
  // ═══════════════════════════════════════════════════════════════

  @Get('stats')
  @CheckPermissions({ module: 'bookings', action: 'view' })
  async getStats() {
    const data = await this.bookingsService.getStats();
    return { success: true, data };
  }

  // ═══════════════════════════════════════════════════════════════
  //  POST /bookings/recurring — Create Recurring Bookings
  // ═══════════════════════════════════════════════════════════════

  @Post('recurring')
  @CheckPermissions({ module: 'bookings', action: 'create' })
  async createRecurring(
    @Body() dto: CreateRecurringBookingDto,
    @CurrentUser() user: { id: string },
  ) {
    const data = await this.bookingRecurringService.createRecurring(user.id, dto);
    return { success: true, data };
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET /bookings — List Bookings
  // ═══════════════════════════════════════════════════════════════

  @Get()
  @CheckPermissions({ module: 'bookings', action: 'view' })
  async findAll(
    @Query() query: BookingListQueryDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.bookingsService.findAllScoped(query, user.id);
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET /bookings/:id/payment-status — Payment status + retry eligibility
  // ═══════════════════════════════════════════════════════════════

  @Get(':id/payment-status')
  @CheckPermissions({ module: 'bookings', action: 'view' })
  async getPaymentStatus(
    @Param('id', uuidPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.bookingsService.getPaymentStatus(id, user.id);
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET /bookings/:id — Booking Details (ownership enforced)
  // ═══════════════════════════════════════════════════════════════

  @Get(':id')
  @CheckPermissions({ module: 'bookings', action: 'view' })
  async findOne(
    @Param('id', uuidPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.bookingsService.findOneScoped(id, user.id);
  }

  // ═══════════════════════════════════════════════════════════════
  //  PATCH /bookings/:id — Reschedule
  // ═══════════════════════════════════════════════════════════════

  @Patch(':id')
  @Throttle({ default: { limit: THROTTLE_LIMIT, ttl: THROTTLE_TTL } })
  @CheckPermissions({ module: 'bookings', action: 'edit' })
  async reschedule(
    @Param('id', uuidPipe) id: string,
    @Body() dto: RescheduleBookingDto,
    @CurrentUser() user: { id: string },
  ) {
    // H7: Pass adminUserId for audit trail — ownership is role-based (bookings:edit permission)
    return this.bookingsService.reschedule(id, dto, user.id);
  }

  // ═══════════════════════════════════════════════════════════════
  //  POST /bookings/:id/patient-reschedule — Patient Self-Reschedule
  // ═══════════════════════════════════════════════════════════════

  @Post(':id/patient-reschedule')
  @Throttle({ default: { limit: THROTTLE_LIMIT, ttl: THROTTLE_TTL } })
  @HttpCode(200)
  @CheckPermissions({ module: 'bookings', action: 'create' })
  async patientReschedule(
    @Param('id', uuidPipe) id: string,
    @Body() dto: RescheduleBookingDto,
    @CurrentUser() user: { id: string },
  ) {
    const data = await this.bookingsService.patientReschedule(id, user.id, dto);
    return { success: true, data };
  }

  // ═══════════════════════════════════════════════════════════════
  //  POST /bookings/:id/confirm
  // ═══════════════════════════════════════════════════════════════

  @Post(':id/confirm')
  @HttpCode(200)
  @CheckPermissions({ module: 'bookings', action: 'edit' })
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
  async checkIn(
    @Param('id', uuidPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    const data = await this.bookingsService.checkIn(id, user.id);
    return { success: true, data };
  }

  // ═══════════════════════════════════════════════════════════════
  //  POST /bookings/:id/start — Start Session (practitioner only)
  // ═══════════════════════════════════════════════════════════════

  @Post(':id/start')
  @HttpCode(200)
  @CheckPermissions({ module: 'bookings', action: 'edit' })
  async startSession(
    @Param('id', uuidPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    const data = await this.bookingsService.startSession(id, user.id);
    return { success: true, data };
  }

  // ═══════════════════════════════════════════════════════════════
  //  POST /bookings/:id/complete
  // ═══════════════════════════════════════════════════════════════

  @Post(':id/complete')
  @HttpCode(200)
  @CheckPermissions({ module: 'bookings', action: 'edit' })
  async complete(
    @Param('id', uuidPipe) id: string,
    @Body() dto: CompleteBookingDto,
  ) {
    const data = await this.bookingsService.complete(id, dto);
    return { success: true, data };
  }

  // ═══════════════════════════════════════════════════════════════
  //  POST /bookings/:id/no-show
  // ═══════════════════════════════════════════════════════════════

  @Post(':id/no-show')
  @HttpCode(200)
  @CheckPermissions({ module: 'bookings', action: 'edit' })
  async markNoShow(@Param('id', uuidPipe) id: string) {
    return this.bookingsService.markNoShow(id);
  }

  // ═══════════════════════════════════════════════════════════════
  //  POST /bookings/:id/cancel-request (patient ownership)
  // ═══════════════════════════════════════════════════════════════

  @Post(':id/cancel-request')
  @HttpCode(200)
  @CheckPermissions({ module: 'bookings', action: 'create' })
  async cancelRequest(
    @Param('id', uuidPipe) id: string,
    @Body() dto: CancelRequestDto,
    @CurrentUser() user: { id: string },
  ) {
    const data = await this.bookingsService.requestCancellation(
      id,
      user.id,
      dto.reason,
    );
    return {
      success: true,
      data,
      message: 'Cancellation request submitted successfully',
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  POST /bookings/:id/cancel/approve
  // ═══════════════════════════════════════════════════════════════

  @Post(':id/cancel/approve')
  @HttpCode(200)
  @CheckPermissions({ module: 'bookings', action: 'edit' })
  async cancelApprove(
    @Param('id', uuidPipe) id: string,
    @Body() dto: CancelApproveDto,
  ) {
    const data = await this.bookingsService.approveCancellation(id, dto);
    return {
      success: true,
      data,
      message: 'Cancellation approved successfully',
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  POST /bookings/:id/cancel/reject
  // ═══════════════════════════════════════════════════════════════

  @Post(':id/cancel/reject')
  @HttpCode(200)
  @CheckPermissions({ module: 'bookings', action: 'edit' })
  async cancelReject(
    @Param('id', uuidPipe) id: string,
    @Body() dto: CancelRejectDto,
  ) {
    const data = await this.bookingsService.rejectCancellation(id, dto);
    return {
      success: true,
      data,
      message: 'Cancellation rejected successfully',
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  POST /bookings/:id/admin-cancel — Admin direct cancel
  // ═══════════════════════════════════════════════════════════════

  @Post(':id/admin-cancel')
  @HttpCode(200)
  @CheckPermissions({ module: 'bookings', action: 'delete' })
  async adminCancel(
    @Param('id', uuidPipe) id: string,
    @Body() dto: AdminCancelDto,
    @CurrentUser() user: { id: string },
  ) {
    const data = await this.bookingsService.adminDirectCancel(id, user.id, dto);
    return {
      success: true,
      data,
      message: 'Booking cancelled by admin successfully',
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  POST /bookings/:id/practitioner-cancel — Practitioner cancel
  // ═══════════════════════════════════════════════════════════════

  @Post(':id/practitioner-cancel')
  @HttpCode(200)
  @CheckPermissions({ module: 'bookings', action: 'delete' })
  async practitionerCancel(
    @Param('id', uuidPipe) id: string,
    @Body() dto: CancelRequestDto,
    @CurrentUser() user: { id: string },
  ) {
    const data = await this.bookingsService.practitionerCancel(id, user.id, dto.reason);
    return {
      success: true,
      data,
      message: 'Booking cancelled by practitioner successfully',
    };
  }
}
