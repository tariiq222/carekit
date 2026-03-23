import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { BookingListQueryDto } from './dto/booking-list-query.dto.js';
import { bookingInclude } from './booking.constants.js';
import { resolveUserRoleContext } from '../../common/helpers/user-role.helper.js';

@Injectable()
export class BookingQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: BookingListQueryDto) {
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
    return this.findTodayBookings(practitioner.id);
  }

  async findTodayBookings(practitionerId: string, page = 1, perPage = 50) {
    perPage = Math.min(perPage, 100);
    const skip = (page - 1) * perPage;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const where = { practitionerId, date: { gte: today, lt: tomorrow }, deletedAt: null };
    const [rawItems, total] = await Promise.all([
      this.prisma.booking.findMany({ where, include: bookingInclude, orderBy: { startTime: 'asc' }, skip, take: perPage }),
      this.prisma.booking.count({ where }),
    ]);
    const items = rawItems.map(({ deletedAt: _, zoomMeetingId: _z, ...item }) => item);
    const totalPages = Math.ceil(total / perPage);
    return { items, meta: { total, page, perPage, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 } };
  }
}
