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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { CheckPermissions } from '../auth/decorators/check-permissions.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { BookingsService } from './bookings.service.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto.js';
import { CancelRequestDto } from './dto/cancel-request.dto.js';
import { CancelApproveDto } from './dto/cancel-approve.dto.js';
import { CancelRejectDto } from './dto/cancel-reject.dto.js';
import { BookingListQueryDto } from './dto/booking-list-query.dto.js';
import { uuidPipe } from '../../common/pipes/uuid.pipe.js';

@ApiTags('Bookings')
@ApiBearerAuth()
@Controller('bookings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // ═══════════════════════════════════════════════════════════════
  //  POST /bookings — Create Booking
  // ═══════════════════════════════════════════════════════════════

  @Post()
  @CheckPermissions({ module: 'bookings', action: 'create' })
  async create(
    @Body() dto: CreateBookingDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.bookingsService.create(user.id, dto);
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET /bookings/my — Patient's Own Bookings (must be before :id)
  // ═══════════════════════════════════════════════════════════════

  @Get('my')
  async findMyBookings(@CurrentUser() user: { id: string }) {
    return this.bookingsService.findMyBookings(user.id);
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET /bookings/today — Practitioner's Today Bookings
  // ═══════════════════════════════════════════════════════════════

  @Get('today')
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
  //  GET /bookings/:id — Booking Details (ownership enforced)
  // ═══════════════════════════════════════════════════════════════

  @Get(':id')
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
  @CheckPermissions({ module: 'bookings', action: 'edit' })
  async reschedule(
    @Param('id', uuidPipe) id: string,
    @Body() dto: RescheduleBookingDto,
  ) {
    return this.bookingsService.reschedule(id, dto);
  }

  // ═══════════════════════════════════════════════════════════════
  //  POST /bookings/:id/confirm
  // ═══════════════════════════════════════════════════════════════

  @Post(':id/confirm')
  @HttpCode(200)
  @CheckPermissions({ module: 'bookings', action: 'edit' })
  async confirm(@Param('id', uuidPipe) id: string) {
    return this.bookingsService.confirm(id);
  }

  // ═══════════════════════════════════════════════════════════════
  //  POST /bookings/:id/complete
  // ═══════════════════════════════════════════════════════════════

  @Post(':id/complete')
  @HttpCode(200)
  @CheckPermissions({ module: 'bookings', action: 'edit' })
  async complete(@Param('id', uuidPipe) id: string) {
    return this.bookingsService.complete(id);
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
}
