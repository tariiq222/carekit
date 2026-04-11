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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { BookingsService } from './bookings.service.js';
import { BookingRecurringService } from './booking-recurring.service.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { CreateRecurringBookingDto } from './dto/create-recurring-booking.dto.js';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto.js';
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
  @ApiResponse({ status: 201, description: 'Booking created' })
  @ApiStandardResponses()
  async create(
    @Body() dto: CreateBookingDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.bookingsService.create(user.id, dto, user.roles);
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET /bookings — List Bookings
  // ═══════════════════════════════════════════════════════════════

  @Get()
  @CheckPermissions({ module: 'bookings', action: 'view' })
  @ApiOperation({ summary: 'List bookings with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated booking list' })
  @ApiStandardResponses()
  async findAll(
    @Query() query: BookingListQueryDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.bookingsService.findAllScoped(query, user.id);
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET /bookings/my — Patient's Own Bookings (must be before :id)
  // ═══════════════════════════════════════════════════════════════

  @Get('my')
  @CheckPermissions({ module: 'bookings', action: 'view' })
  @ApiOperation({
    summary: "Get current patient's own bookings with pagination",
  })
  @ApiResponse({ status: 200, description: "Patient's bookings" })
  @ApiStandardResponses()
  async findMyBookings(
    @CurrentUser() user: { id: string },
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.bookingsService.findMyBookings(
      user.id,
      pagination.page,
      pagination.perPage,
    );
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET /bookings/today — Practitioner's Today Bookings
  // ═══════════════════════════════════════════════════════════════

  @Get('today')
  @CheckPermissions({ module: 'bookings', action: 'view' })
  @ApiOperation({ summary: "Get practitioner's bookings for today" })
  @ApiResponse({ status: 200, description: "Today's bookings" })
  @ApiStandardResponses()
  async findTodayBookings(@CurrentUser() user: { id: string }) {
    return this.bookingsService.findTodayBookingsForUser(user.id);
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET /bookings/stats — Booking Statistics
  // ═══════════════════════════════════════════════════════════════

  @Get('stats')
  @CheckPermissions({ module: 'bookings', action: 'view' })
  @ApiOperation({ summary: 'Get booking statistics with optional date range' })
  @ApiResponse({ status: 200, description: 'Booking statistics' })
  @ApiStandardResponses()
  async getStats(
    @CurrentUser() user: { id: string },
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.bookingsService.getStats(user.id, dateFrom, dateTo);
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET /bookings/:id — Booking Details (ownership enforced)
  // ═══════════════════════════════════════════════════════════════

  @Get(':id')
  @CheckPermissions({ module: 'bookings', action: 'view' })
  @ApiOperation({ summary: 'Get booking details by ID' })
  @ApiResponse({ status: 200, description: 'Booking details' })
  @ApiStandardResponses()
  async findOne(
    @Param('id', uuidPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.bookingsService.findOneScoped(id, user.id);
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET /bookings/:id/payment-status — Payment status + retry eligibility
  // ═══════════════════════════════════════════════════════════════

  @Get(':id/payment-status')
  @CheckPermissions({ module: 'bookings', action: 'view' })
  @ApiOperation({ summary: 'Get booking payment status and retry eligibility' })
  @ApiResponse({ status: 200, description: 'Payment status details' })
  @ApiStandardResponses()
  async getPaymentStatus(
    @Param('id', uuidPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.bookingsService.getPaymentStatus(id, user.id);
  }

  // ═══════════════════════════════════════════════════════════════
  //  PATCH /bookings/:id — Reschedule
  // ═══════════════════════════════════════════════════════════════

  @Patch(':id')
  @Throttle({ default: { limit: THROTTLE_LIMIT, ttl: THROTTLE_TTL } })
  @CheckPermissions({ module: 'bookings', action: 'edit' })
  @ApiOperation({ summary: 'Reschedule a booking' })
  @ApiResponse({ status: 200, description: 'Booking rescheduled' })
  @ApiStandardResponses()
  async reschedule(
    @Param('id', uuidPipe) id: string,
    @Body() dto: RescheduleBookingDto,
    @CurrentUser() user: { id: string },
  ) {
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
  @ApiResponse({ status: 200, description: 'Booking rescheduled by patient' })
  @ApiStandardResponses()
  async patientReschedule(
    @Param('id', uuidPipe) id: string,
    @Body() dto: RescheduleBookingDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.bookingsService.patientReschedule(id, user.id, dto);
  }

  // ═══════════════════════════════════════════════════════════════
  //  POST /bookings/recurring — Create Recurring Bookings
  // ═══════════════════════════════════════════════════════════════

  @Post('recurring')
  @CheckPermissions({ module: 'bookings', action: 'create' })
  @ApiOperation({ summary: 'Create recurring booking series' })
  @ApiResponse({ status: 201, description: 'Recurring booking series created' })
  @ApiStandardResponses()
  async createRecurring(
    @Body() dto: CreateRecurringBookingDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.bookingRecurringService.createRecurring(
      user.id,
      dto,
      user.roles,
    );
  }
}
