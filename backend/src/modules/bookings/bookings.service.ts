import {
  BadRequestException,
  ConflictException,
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

const bookingInclude = {
  patient: true,
  practitioner: {
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      specialty: { select: { nameEn: true, nameAr: true } },
    },
  },
  service: true,
};

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('ZoomService') private readonly zoomService: ZoomService,
    private readonly cancellationService: BookingCancellationService,
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

    const bookingDate = new Date(dto.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (bookingDate < today) {
      throw new BadRequestException({ statusCode: 400, message: 'Cannot book in the past', error: 'VALIDATION_ERROR' });
    }

    const endTime = this.calculateEndTime(dto.startTime, service.duration);
    await this.checkDoubleBooking(dto.practitionerId, bookingDate, dto.startTime, endTime);

    let zoomData: { zoomMeetingId?: string; zoomJoinUrl?: string; zoomHostUrl?: string } = {};
    if (dto.type === 'video_consultation') {
      const meeting = await this.zoomService.createMeeting();
      zoomData = { zoomMeetingId: meeting.meetingId, zoomJoinUrl: meeting.joinUrl, zoomHostUrl: meeting.hostUrl };
    }

    return this.prisma.booking.create({
      data: {
        patientId,
        practitionerId: dto.practitionerId,
        serviceId: dto.serviceId,
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
    const booking = await this.prisma.booking.findFirst({ where: { id, deletedAt: null } });
    if (!booking) {
      throw new NotFoundException({ statusCode: 404, message: 'Booking not found', error: 'NOT_FOUND' });
    }

    const newStartTime = dto.startTime ?? booking.startTime;
    const newDate = dto.date ? new Date(dto.date) : booking.date;

    const service = await this.prisma.service.findFirst({ where: { id: booking.serviceId } });
    const duration = service?.duration ?? 30;
    const newEndTime = this.calculateEndTime(newStartTime, duration);

    await this.checkDoubleBooking(booking.practitionerId, newDate, newStartTime, newEndTime, id);

    return this.prisma.booking.update({
      where: { id },
      data: { date: newDate, startTime: newStartTime, endTime: newEndTime },
      include: bookingInclude,
    });
  }

  async confirm(id: string) {
    const booking = await this.ensureBookingExists(id);
    if (booking.status !== 'pending') {
      throw new ConflictException({ statusCode: 409, message: `Cannot confirm booking with status '${booking.status}'`, error: 'CONFLICT' });
    }
    return this.prisma.booking.update({ where: { id }, data: { status: 'confirmed', confirmedAt: new Date() }, include: bookingInclude });
  }

  async complete(id: string) {
    const booking = await this.ensureBookingExists(id);
    if (booking.status !== 'confirmed') {
      throw new ConflictException({ statusCode: 409, message: `Cannot complete booking with status '${booking.status}'`, error: 'CONFLICT' });
    }
    return this.prisma.booking.update({ where: { id }, data: { status: 'completed', completedAt: new Date() }, include: bookingInclude });
  }

  async findMyBookings(patientId: string) {
    const where = { patientId, deletedAt: null };
    const [rawItems, total] = await Promise.all([
      this.prisma.booking.findMany({ where, include: bookingInclude, orderBy: { createdAt: 'desc' } }),
      this.prisma.booking.count({ where }),
    ]);
    const items = rawItems.map(({ deletedAt: _, zoomMeetingId: _z, ...item }) => item);
    return { items, meta: { total, page: 1, perPage: total || 20, totalPages: 1, hasNextPage: false, hasPreviousPage: false } };
  }

  async findTodayBookings(userId: string) {
    const practitioner = await this.prisma.practitioner.findFirst({ where: { userId, deletedAt: null } });
    if (!practitioner) {
      throw new NotFoundException({ statusCode: 404, message: 'Practitioner profile not found', error: 'NOT_FOUND' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const rawItems = await this.prisma.booking.findMany({
      where: { practitionerId: practitioner.id, date: { gte: today, lt: tomorrow }, deletedAt: null },
      include: bookingInclude,
      orderBy: { startTime: 'asc' },
    });
    const items = rawItems.map(({ deletedAt: _, zoomMeetingId: _z, ...item }) => item);
    return { items, meta: { total: items.length, page: 1, perPage: items.length || 20, totalPages: 1, hasNextPage: false, hasPreviousPage: false } };
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

  private async checkDoubleBooking(practitionerId: string, date: Date, startTime: string, endTime: string, excludeId?: string) {
    const whereClause: Record<string, unknown> = {
      practitionerId,
      date,
      status: { in: ['pending', 'confirmed'] },
      deletedAt: null,
    };
    if (excludeId) whereClause.id = { not: excludeId };

    const existingBookings = await this.prisma.booking.findMany({ where: whereClause });
    const hasConflict = existingBookings.some((existing) => this.timeSlotsOverlap(startTime, endTime, existing.startTime, existing.endTime));

    if (hasConflict) {
      throw new ConflictException({ statusCode: 409, message: 'Practitioner already has a booking at this time', error: 'BOOKING_CONFLICT' });
    }
  }

  private calculateEndTime(startTime: string, durationMinutes: number): string {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
  }

  private timeSlotsOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
    const toMinutes = (time: string) => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    };
    return toMinutes(start1) < toMinutes(end2) && toMinutes(start2) < toMinutes(end1);
  }
}
