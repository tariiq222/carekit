import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { BookingListQueryDto } from './dto/booking-list-query.dto.js';
import { bookingInclude } from './booking.constants.js';
import { resolveUserRoleContext } from '../../common/helpers/user-role.helper.js';
import { parsePaginationParams, buildPaginationMeta } from '../../common/helpers/pagination.helper.js';
import { buildDateRangeFilter } from '../../common/helpers/date-filter.helper.js';
import { toMinutes, minutesToTime } from '../../common/helpers/booking-time.helper.js';

@Injectable()
export class BookingQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: BookingListQueryDto) {
    const { page, perPage, skip } = parsePaginationParams(query.page, query.perPage);

    const where: Record<string, unknown> = { deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.practitionerId) where.practitionerId = query.practitionerId;
    if (query.patientId) where.patientId = query.patientId;
    if (query.branchId) where.branchId = query.branchId;
    const dateRange = buildDateRangeFilter(query.dateFrom, query.dateTo);
    if (dateRange) where.date = dateRange;

    const [rawItems, total] = await Promise.all([
      this.prisma.booking.findMany({ where, include: bookingInclude, orderBy: { createdAt: 'desc' }, skip, take: perPage }),
      this.prisma.booking.count({ where }),
    ]);

    const items = rawItems.map(({ deletedAt: _, zoomMeetingId: _z, ...item }) => item);

    return {
      items,
      meta: buildPaginationMeta(total, page, perPage),
    };
  }

  async findOne(id: string) {
    const booking = await this.prisma.booking.findFirst({ where: { id, deletedAt: null }, include: bookingInclude });
    if (!booking) {
      throw new NotFoundException({ statusCode: 404, message: 'Booking not found', error: 'NOT_FOUND' });
    }
    return booking;
  }

  async findAllScoped(query: BookingListQueryDto, userId: string) {
    const ctx = await resolveUserRoleContext(this.prisma, userId);

    if (!ctx.isAdmin) {
      if (ctx.isPractitioner && ctx.practitionerId) {
        query.practitionerId = ctx.practitionerId;
      } else {
        query.patientId = userId;
      }
    }

    return this.findAll(query);
  }

  async findOneScoped(bookingId: string, userId: string) {
    const booking = await this.findOne(bookingId);
    const ctx = await resolveUserRoleContext(this.prisma, userId);

    if (ctx.isAdmin) return booking;
    if (booking.patientId === userId) return booking;
    if (ctx.practitionerId && booking.practitionerId === ctx.practitionerId) return booking;

    throw new ForbiddenException({
      statusCode: 403,
      message: 'You do not have access to this booking',
      error: 'FORBIDDEN',
    });
  }

  async findMyBookings(patientId: string, page = 1, perPage = 20) {
    const pagination = parsePaginationParams(page, perPage);
    const where = { patientId, deletedAt: null };
    const [rawItems, total] = await Promise.all([
      this.prisma.booking.findMany({ where, include: bookingInclude, orderBy: { createdAt: 'desc' }, skip: pagination.skip, take: pagination.perPage }),
      this.prisma.booking.count({ where }),
    ]);
    const items = rawItems.map(({ deletedAt: _, zoomMeetingId: _z, ...item }) => item);
    return { items, meta: buildPaginationMeta(total, pagination.page, pagination.perPage) };
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
    return this.findTodayBookings(practitioner.id);
  }

  async findTodayBookings(practitionerId: string, page = 1, perPage = 50) {
    const pagination = parsePaginationParams(page, perPage);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const where = { practitionerId, date: { gte: today, lt: tomorrow }, deletedAt: null };
    const [rawItems, total] = await Promise.all([
      this.prisma.booking.findMany({ where, include: bookingInclude, orderBy: { startTime: 'asc' }, skip: pagination.skip, take: pagination.perPage }),
      this.prisma.booking.count({ where }),
    ]);
    const items = rawItems.map(({ deletedAt: _, zoomMeetingId: _z, ...item }) => item);
    return { items, meta: buildPaginationMeta(total, pagination.page, pagination.perPage) };
  }

  async getNextAvailableSlots(
    practitionerId: string,
    date: Date,
    count: number,
    branchId?: string,
  ): Promise<Array<{ date: string; startTime: string; endTime: string }>> {
    const slots: Array<{ date: string; startTime: string; endTime: string }> = [];
    const activeStatuses: BookingStatus[] = [
      BookingStatus.pending, BookingStatus.confirmed,
      BookingStatus.checked_in, BookingStatus.in_progress,
    ];

    // Pre-compute the 8-day range and collect unique days of week
    const dates: Date[] = [];
    const daysOfWeek = new Set<number>();
    for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
      const d = new Date(date);
      d.setDate(d.getDate() + dayOffset);
      dates.push(d);
      daysOfWeek.add(d.getDay());
    }

    const rangeStart = dates[0];
    const rangeEnd = new Date(dates[dates.length - 1]);
    rangeEnd.setDate(rangeEnd.getDate() + 1);

    // 2 bulk queries instead of up to 16 sequential ones
    const [allAvailabilities, allBookings] = await Promise.all([
      this.prisma.practitionerAvailability.findMany({
        where: {
          practitionerId,
          dayOfWeek: { in: [...daysOfWeek] },
          isActive: true,
          ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {}),
        },
      }),
      this.prisma.booking.findMany({
        where: {
          practitionerId,
          date: { gte: rangeStart, lt: rangeEnd },
          status: { in: activeStatuses },
          deletedAt: null,
        },
        select: { date: true, startTime: true, endTime: true },
        orderBy: { startTime: 'asc' },
      }),
    ]);

    // Index availability by dayOfWeek and bookings by date string
    const availByDay = new Map<number, typeof allAvailabilities>();
    for (const a of allAvailabilities) {
      const list = availByDay.get(a.dayOfWeek) ?? [];
      list.push(a);
      availByDay.set(a.dayOfWeek, list);
    }

    const bookingsByDate = new Map<string, typeof allBookings>();
    for (const b of allBookings) {
      const key = new Date(b.date).toISOString().split('T')[0];
      const list = bookingsByDate.get(key) ?? [];
      list.push(b);
      bookingsByDate.set(key, list);
    }

    for (let dayOffset = 0; dayOffset <= 7 && slots.length < count; dayOffset++) {
      const checkDate = dates[dayOffset];
      const dayOfWeek = checkDate.getDay();
      const dateStr = checkDate.toISOString().split('T')[0];

      const availabilities = availByDay.get(dayOfWeek) ?? [];
      if (availabilities.length === 0) continue;

      const existingBookings = bookingsByDate.get(dateStr) ?? [];

      for (const avail of availabilities) {
        const availStart = toMinutes(avail.startTime);
        const availEnd = toMinutes(avail.endTime);

        for (let slotStart = availStart; slotStart + 30 <= availEnd && slots.length < count; slotStart += 30) {
          const slotEnd = slotStart + 30;
          const slotStartStr = minutesToTime(slotStart);
          const slotEndStr = minutesToTime(slotEnd);

          const hasConflict = existingBookings.some((b) => {
            const bStart = toMinutes(b.startTime);
            const bEnd = toMinutes(b.endTime);
            return slotStart < bEnd && bStart < slotEnd;
          });

          if (hasConflict) continue;

          // Skip past slots on same day
          if (dayOffset === 0) {
            const now = new Date();
            const nowMinutes = now.getHours() * 60 + now.getMinutes();
            if (slotStart <= nowMinutes) continue;
          }

          slots.push({
            date: dateStr,
            startTime: slotStartStr,
            endTime: slotEndStr,
          });
        }
      }
    }

    return slots;
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
      checkedIn: map['checked_in'] ?? 0,
      inProgress: map['in_progress'] ?? 0,
      noShow: map['no_show'] ?? 0,
      expired: map['expired'] ?? 0,
    };
  }

  async getPaymentStatus(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
      select: {
        id: true,
        patientId: true,
        status: true,
        payment: {
          select: {
            id: true,
            method: true,
            status: true,
            totalAmount: true,
            refundAmount: true,
            refundedAt: true,
            refundReason: true,
            createdAt: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException({ statusCode: 404, message: 'Booking not found', error: 'NOT_FOUND' });
    }

    const ctx = await resolveUserRoleContext(this.prisma, userId);
    const isOwner = booking.patientId === userId;
    if (!isOwner && ctx.role === 'patient') {
      throw new ForbiddenException({ statusCode: 403, message: 'Access denied', error: 'FORBIDDEN' });
    }

    const RETRYABLE_STATUSES = ['failed', 'pending', 'awaiting'];
    const canRetry =
      !booking.payment ||
      RETRYABLE_STATUSES.includes(booking.payment.status);

    return {
      bookingId: booking.id,
      bookingStatus: booking.status,
      payment: booking.payment ?? null,
      canRetry,
    };
  }
}
