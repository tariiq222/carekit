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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
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
  @ApiOperation({ summary: 'Create a new booking' })
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
  @ApiOperation({ summary: "Get current patient's own bookings with pagination" })
  async findMyBookings(
    @CurrentUser() user: { id: string },
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.bookingsService.findMyBookings(user.id, pagination.page, pagination.perPage);
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET /bookings/today — Practitioner's Today Bookings
  // ═══════════════════════════════════════════════════════════════

  @Get('today')
  @CheckPermissions({ module: 'bookings', action: 'view' })
  @ApiOperation({ summary: "Get practitioner's bookings for today" })
  async findTodayBookings(@CurrentUser() user: { id: string }) {
    return this.bookingsService.findTodayBookingsForUser(user.id);
  }
  // GET /bookings/stats — Booking Statistics
  @Get('stats')
  @CheckPermissions({ module: 'bookings', action: 'view' })
  @ApiOperation({ summary: 'Get booking statistics with optional date range' })
  async getStats(
    @CurrentUser() user: { id: string },
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.bookingsService.getStats(user.id, dateFrom, dateTo);
  }

  // ═══════════════════════════════════════════════════════════════
  //  POST /bookings/recurring — Create Recurring Bookings
  // ═══════════════════════════════════════════════════════════════

  @Post('recurring')
  @CheckPermissions({ module: 'bookings', action: 'create' })
  @ApiOperation({ summary: 'Create recurring booking series' })
  async createRecurring(
    @Body() dto: CreateRecurringBookingDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.bookingRecurringService.createRecurring(user.id, dto);
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET /bookings — List Bookings
  // ═══════════════════════════════════════════════════════════════

  @Get()
  @CheckPermissions({ module: 'bookings', action: 'view' })
  @ApiOperation({ summary: 'List bookings with filters and pagination' })
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
  @ApiOperation({ summary: 'Get booking payment status and retry eligibility' })
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
  @ApiOperation({ summary: 'Get booking details by ID' })
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
  @ApiOperation({ summary: 'Reschedule a booking' })
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
  @ApiOperation({ summary: 'Patient self-reschedule a booking' })
  async patientReschedule(
    @Param('id', uuidPipe) id: string,
    @Body() dto: RescheduleBookingDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.bookingsService.patientReschedule(id, user.id, dto);
  }

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
