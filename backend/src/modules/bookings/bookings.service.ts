import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto.js';
import { CancelApproveDto } from './dto/cancel-approve.dto.js';
import { CancelRejectDto } from './dto/cancel-reject.dto.js';
import { ZoomService } from './zoom.service.js';
import { BookingCancellationService } from './booking-cancellation.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { validateAvailability } from './booking-validation.helper.js';
import { timeSlotsOverlap, shiftTime, calculateEndTime } from '../../common/helpers/booking-time.helper.js';
import { bookingInclude } from './booking.constants.js';

interface BookingListQuery {
  page?: number;
  perPage?: number;
  status?: string;
  type?: string;
  practitionerId?: string;
  patientId?: string;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('ZoomService') private readonly zoomService: ZoomService,
    private readonly cancellationService: BookingCancellationService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(patientId: string, dto: CreateBookingDto) {
    const practitioner = await this.prisma.practitioner.findFirst({
      where: { id: dto.practitionerId, isActive: true, deletedAt: null },
    });
    if (!practitioner) {
      throw new NotFoundException({ statusCode: 404, message: 'Practitioner not found', error: 'NOT_FOUND' });
    }

    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, isActive: true, deletedAt: null },
    });
    if (!service) {
      throw new NotFoundException({ statusCode: 404, message: 'Service not found', error: 'NOT_FOUND' });
    }

    // Validate practitioner offers this service
    const ps = await this.prisma.practitionerService.findUnique({
      where: { practitionerId_serviceId: { practitionerId: dto.practitionerId, serviceId: dto.serviceId } },
    });
    if (!ps) {
      throw new BadRequestException({ statusCode: 400, message: 'Practitioner does not offer this service', error: 'SERVICE_NOT_OFFERED' });
    }
    if (!ps.isActive) {
      throw new BadRequestException({ statusCode: 400, message: 'This service is currently unavailable for this practitioner', error: 'SERVICE_INACTIVE' });
    }
    if (!ps.availableTypes.includes(dto.type)) {
      throw new BadRequestException({ statusCode: 400, message: `Booking type '${dto.type}' is not available for this service`, error: 'TYPE_NOT_AVAILABLE' });
    }

    const bookingDate = new Date(dto.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (bookingDate < today) {
      throw new BadRequestException({ statusCode: 400, message: 'Cannot book in the past', error: 'VALIDATION_ERROR' });
    }

    const duration = ps.customDuration ?? service.duration;
    const endTime = calculateEndTime(dto.startTime, duration);

    await validateAvailability(this.prisma,dto.practitionerId, bookingDate, dto.startTime, endTime);
    await this.checkDoubleBooking(dto.practitionerId, bookingDate, dto.startTime, endTime, undefined, ps.bufferBefore, ps.bufferAfter);

    let zoomData: { zoomMeetingId?: string; zoomJoinUrl?: string; zoomHostUrl?: string } = {};
    if (dto.type === 'video_consultation') {
      const meeting = await this.zoomService.createMeeting();
      zoomData = { zoomMeetingId: meeting.meetingId, zoomJoinUrl: meeting.joinUrl, zoomHostUrl: meeting.hostUrl };
    }

    const booking = await this.prisma.booking.create({
      data: {
        patientId,
        practitionerId: dto.practitionerId,
        serviceId: dto.serviceId,
        practitionerServiceId: ps.id,
        type: dto.type,
        date: bookingDate,
        startTime: dto.startTime,
        endTime,
        status: 'pending',
        notes: dto.notes,
        ...zoomData,
      },
      include: bookingInclude,
    });

    // Notify practitioner about new booking
    if (practitioner.userId) {
      const d = bookingDate.toISOString().split('T')[0];
      await this.notify(practitioner.userId, 'booking_confirmed', 'حجز جديد', 'New Booking',
        `لديك حجز جديد بتاريخ ${d} الساعة ${dto.startTime}`,
        `You have a new booking on ${d} at ${dto.startTime}`, { bookingId: booking.id });
    }

    return booking;
  }

  async getStats() {
    const counts = await this.prisma.booking.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: { _all: true },
    });

    const map = Object.fromEntries(counts.map((g) => [g.status, g._count._all]));

    return {
      total: counts.reduce((acc, g) => acc + g._count._all, 0),
      confirmed: map['confirmed'] ?? 0,
      pending: map['pending'] ?? 0,
      completed: map['completed'] ?? 0,
      cancelled: map['cancelled'] ?? 0,
      pendingCancellation: map['pending_cancellation'] ?? 0,
    };
  }

  async findAll(query: BookingListQuery) {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where: Record<string, unknown> = { deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.practitionerId) where.practitionerId = query.practitionerId;
    if (query.patientId) where.patientId = query.patientId;
    if (query.dateFrom || query.dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (query.dateFrom) dateFilter.gte = new Date(query.dateFrom);
      if (query.dateTo) dateFilter.lte = new Date(query.dateTo);
      where.date = dateFilter;
    }

    const [rawItems, total] = await Promise.all([
      this.prisma.booking.findMany({ where, include: bookingInclude, orderBy: { createdAt: 'desc' }, skip, take: perPage }),
      this.prisma.booking.count({ where }),
    ]);

    const items = rawItems.map(({ deletedAt: _, zoomMeetingId: _z, ...item }) => item);
    const totalPages = Math.ceil(total / perPage);

    return {
      items,
      meta: { total, page, perPage, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 },
    };
  }

  async findOne(id: string) {
    const booking = await this.prisma.booking.findFirst({ where: { id, deletedAt: null }, include: bookingInclude });
    if (!booking) {
      throw new NotFoundException({ statusCode: 404, message: 'Booking not found', error: 'NOT_FOUND' });
    }
    return booking;
  }

  async reschedule(id: string, dto: RescheduleBookingDto) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, deletedAt: null },
    });
    if (!booking) {
      throw new NotFoundException({ statusCode: 404, message: 'Booking not found', error: 'NOT_FOUND' });
    }
    const newStartTime = dto.startTime ?? booking.startTime;
    const newDate = dto.date ? new Date(dto.date) : booking.date;

    const ps = await this.prisma.practitionerService.findUnique({ where: { id: booking.practitionerServiceId } });
    const service = await this.prisma.service.findFirst({ where: { id: booking.serviceId } });
    const duration = ps?.customDuration ?? service?.duration ?? 30;
    const newEndTime = calculateEndTime(newStartTime, duration);

    await validateAvailability(this.prisma, booking.practitionerId, newDate, newStartTime, newEndTime);
    await this.checkDoubleBooking(booking.practitionerId, newDate, newStartTime, newEndTime, id, ps?.bufferBefore ?? 0, ps?.bufferAfter ?? 0);

    // Create new booking linked to original, cancel the old one
    return this.prisma.$transaction(async (tx) => {
      const newBooking = await tx.booking.create({
        data: {
          patientId: booking.patientId,
          practitionerId: booking.practitionerId,
          serviceId: booking.serviceId,
          practitionerServiceId: booking.practitionerServiceId,
          type: booking.type,
          date: newDate,
          startTime: newStartTime,
          endTime: newEndTime,
          status: booking.status,
          notes: booking.notes,
          zoomMeetingId: booking.zoomMeetingId,
          zoomJoinUrl: booking.zoomJoinUrl,
          zoomHostUrl: booking.zoomHostUrl,
          confirmedAt: booking.confirmedAt,
          rescheduledFromId: id,
        },
        include: bookingInclude,
      });

      // Cancel old booking with reschedule note
      await tx.booking.update({
        where: { id },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
          adminNotes: `Rescheduled to booking ${newBooking.id}`,
        },
      });

      // Move payment to new booking if exists
      await tx.payment.updateMany({
        where: { bookingId: id },
        data: { bookingId: newBooking.id },
      });

      return newBooking;
    });
  }

  async confirm(id: string) {
    const booking = await this.ensureBookingExists(id);
    if (booking.status !== 'pending') {
      throw new ConflictException({ statusCode: 409, message: `Cannot confirm booking with status '${booking.status}'`, error: 'CONFLICT' });
    }

    // Prepayment required — check payment exists and is paid
    const payment = await this.prisma.payment.findFirst({ where: { bookingId: id } });
    if (!payment || payment.status !== 'paid') {
      throw new ConflictException({ statusCode: 409, message: 'Payment is required before confirming a booking', error: 'PAYMENT_REQUIRED' });
    }

    const confirmed = await this.prisma.booking.update({ where: { id }, data: { status: 'confirmed', confirmedAt: new Date() }, include: bookingInclude });

    if (confirmed.patientId) {
      const d = confirmed.date.toISOString().split('T')[0];
      await this.notify(confirmed.patientId, 'booking_confirmed', 'تأكيد الموعد', 'Booking Confirmed',
        `تم تأكيد موعدك بتاريخ ${d} الساعة ${confirmed.startTime}`,
        `Your booking on ${d} at ${confirmed.startTime} has been confirmed`, { bookingId: id });
    }
    return confirmed;
  }

  async complete(id: string) {
    const booking = await this.ensureBookingExists(id);
    if (booking.status !== 'confirmed') {
      throw new ConflictException({ statusCode: 409, message: `Cannot complete booking with status '${booking.status}'`, error: 'CONFLICT' });
    }
    const completed = await this.prisma.booking.update({ where: { id }, data: { status: 'completed', completedAt: new Date() }, include: bookingInclude });

    if (completed.patientId) {
      await this.notify(completed.patientId, 'booking_completed', 'اكتمل الموعد', 'Booking Completed',
        'تم اكتمال موعدك. يمكنك الآن تقييم تجربتك',
        'Your booking is completed. You can now rate your experience', { bookingId: id });
    }
    return completed;
  }

  async markNoShow(id: string) {
    const booking = await this.ensureBookingExists(id);
    if (booking.status !== 'confirmed') {
      throw new ConflictException({ statusCode: 409, message: `Cannot mark no-show for booking with status '${booking.status}'`, error: 'CONFLICT' });
    }
    return this.prisma.booking.update({
      where: { id },
      data: { status: 'no_show' },
      include: bookingInclude,
    });
  }

  async findMyBookings(patientId: string, page = 1, perPage = 20) {
    perPage = Math.min(perPage, 100);
    const skip = (page - 1) * perPage;
    const where = { patientId, deletedAt: null };
    const [rawItems, total] = await Promise.all([
      this.prisma.booking.findMany({ where, include: bookingInclude, orderBy: { createdAt: 'desc' }, skip, take: perPage }),
      this.prisma.booking.count({ where }),
    ]);
    const items = rawItems.map(({ deletedAt: _, zoomMeetingId: _z, ...item }) => item);
    const totalPages = Math.ceil(total / perPage);
    return { items, meta: { total, page, perPage, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 } };
  }

  async findTodayBookingsForUser(userId: string) {
    const practitioner = await this.prisma.practitioner.findFirst({
      where: { userId, deletedAt: null },
    });
    if (!practitioner) {
      throw new ForbiddenException({
        statusCode: 403,
        message: "Only practitioners can access today's bookings",
        error: 'FORBIDDEN',
      });
    }
    return this.findTodayBookings(userId);
  }

  async findTodayBookings(userId: string, page = 1, perPage = 50) {
    const practitioner = await this.prisma.practitioner.findFirst({ where: { userId, deletedAt: null } });
    if (!practitioner) {
      throw new NotFoundException({ statusCode: 404, message: 'Practitioner profile not found', error: 'NOT_FOUND' });
    }

    perPage = Math.min(perPage, 100);
    const skip = (page - 1) * perPage;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const where = { practitionerId: practitioner.id, date: { gte: today, lt: tomorrow }, deletedAt: null };
    const [rawItems, total] = await Promise.all([
      this.prisma.booking.findMany({ where, include: bookingInclude, orderBy: { startTime: 'asc' }, skip, take: perPage }),
      this.prisma.booking.count({ where }),
    ]);
    const items = rawItems.map(({ deletedAt: _, zoomMeetingId: _z, ...item }) => item);
    const totalPages = Math.ceil(total / perPage);
    return { items, meta: { total, page, perPage, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 } };
  }

  // --- Delegated: Cancellation ---

  async requestCancellation(id: string, patientId: string, reason?: string) {
    return this.cancellationService.requestCancellation(id, patientId, reason);
  }

  async approveCancellation(id: string, dto: CancelApproveDto) {
    return this.cancellationService.approveCancellation(id, dto);
  }

  async rejectCancellation(id: string, dto: CancelRejectDto) {
    return this.cancellationService.rejectCancellation(id, dto);
  }

  // --- Helpers ---

  private async ensureBookingExists(id: string) {
    const booking = await this.prisma.booking.findFirst({ where: { id, deletedAt: null } });
    if (!booking) {
      throw new NotFoundException({ statusCode: 404, message: 'Booking not found', error: 'NOT_FOUND' });
    }
    return booking;
  }

  private async checkDoubleBooking(
    practitionerId: string, date: Date, startTime: string, endTime: string,
    excludeId?: string, bufferBefore: number = 0, bufferAfter: number = 0,
  ) {
    const whereClause: Record<string, unknown> = {
      practitionerId, date,
      status: { in: ['pending', 'confirmed'] },
      deletedAt: null,
    };
    if (excludeId) whereClause.id = { not: excludeId };

    const existingBookings = await this.prisma.booking.findMany({ where: whereClause });
    // Expand slot by buffer: effective = (startTime - bufferBefore) to (endTime + bufferAfter)
    const effectiveStart = shiftTime(startTime, -bufferBefore);
    const effectiveEnd = shiftTime(endTime, bufferAfter);
    const hasConflict = existingBookings.some((existing) =>
      timeSlotsOverlap(effectiveStart, effectiveEnd, existing.startTime, existing.endTime),
    );
    if (hasConflict) {
      throw new ConflictException({ statusCode: 409, message: 'Practitioner already has a booking at this time', error: 'BOOKING_CONFLICT' });
    }
  }

  private async notify(
    userId: string, type: string, titleAr: string, titleEn: string,
    bodyAr: string, bodyEn: string, data?: Record<string, unknown>,
  ) {
    await this.notificationsService.createNotification({ userId, titleAr, titleEn, bodyAr, bodyEn, type, data });
  }
}
