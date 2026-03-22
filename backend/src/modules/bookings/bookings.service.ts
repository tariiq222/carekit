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
  ) {}

  // ═══════════════════════════════════════════════════════════════
  //  CREATE
  // ═══════════════════════════════════════════════════════════════

  async create(patientId: string, dto: CreateBookingDto) {
    // Validate practitioner exists and is active
    const practitioner = await this.prisma.practitioner.findFirst({
      where: { id: dto.practitionerId, isActive: true, deletedAt: null },
    });
    if (!practitioner) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Practitioner not found',
        error: 'NOT_FOUND',
      });
    }

    // Validate service exists and is active
    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, isActive: true, deletedAt: null },
    });
    if (!service) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Service not found',
        error: 'NOT_FOUND',
      });
    }

    // Reject past dates
    const bookingDate = new Date(dto.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (bookingDate < today) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Cannot book in the past',
        error: 'VALIDATION_ERROR',
      });
    }

    // Calculate endTime from service duration
    const endTime = this.calculateEndTime(dto.startTime, service.duration);

    // Double-booking check: find overlapping bookings for the same practitioner on the same date
    const existingBookings = await this.prisma.booking.findMany({
      where: {
        practitionerId: dto.practitionerId,
        date: bookingDate,
        status: { in: ['pending', 'confirmed'] },
        deletedAt: null,
      },
    });

    const hasConflict = existingBookings.some((existing) =>
      this.timeSlotsOverlap(
        dto.startTime,
        endTime,
        existing.startTime,
        existing.endTime,
      ),
    );

    if (hasConflict) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Practitioner already has a booking at this time',
        error: 'BOOKING_CONFLICT',
      });
    }

    // Generate Zoom links for video consultations
    let zoomData: {
      zoomMeetingId?: string;
      zoomJoinUrl?: string;
      zoomHostUrl?: string;
    } = {};
    if (dto.type === 'video_consultation') {
      const meeting = await this.zoomService.createMeeting();
      zoomData = {
        zoomMeetingId: meeting.meetingId,
        zoomJoinUrl: meeting.joinUrl,
        zoomHostUrl: meeting.hostUrl,
      };
    }

    const booking = await this.prisma.booking.create({
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

    return booking;
  }

  // ═══════════════════════════════════════════════════════════════
  //  FIND ALL (paginated + filters)
  // ═══════════════════════════════════════════════════════════════

  async findAll(query: BookingListQuery) {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (query.status) {
      where.status = query.status;
    }
    if (query.type) {
      where.type = query.type;
    }
    if (query.practitionerId) {
      where.practitionerId = query.practitionerId;
    }
    if (query.patientId) {
      where.patientId = query.patientId;
    }
    if (query.dateFrom || query.dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (query.dateFrom) {
        dateFilter.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        dateFilter.lte = new Date(query.dateTo);
      }
      where.date = dateFilter;
    }

    const [rawItems, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: bookingInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.booking.count({ where }),
    ]);

    // Strip internal fields from public response
    const items = rawItems.map(
      ({ deletedAt: _, zoomMeetingId: _z, ...item }) => item,
    );

    const totalPages = Math.ceil(total / perPage);

    return {
      items,
      meta: {
        total,
        page,
        perPage,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  FIND ONE
  // ═══════════════════════════════════════════════════════════════

  async findOne(id: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, deletedAt: null },
      include: bookingInclude,
    });
    if (!booking) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Booking not found',
        error: 'NOT_FOUND',
      });
    }
    return booking;
  }

  // ═══════════════════════════════════════════════════════════════
  //  RESCHEDULE
  // ═══════════════════════════════════════════════════════════════

  async reschedule(id: string, dto: RescheduleBookingDto) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, deletedAt: null },
    });
    if (!booking) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Booking not found',
        error: 'NOT_FOUND',
      });
    }

    const newStartTime = dto.startTime ?? booking.startTime;
    const newDate = dto.date ? new Date(dto.date) : booking.date;

    // Fetch service for duration
    const service = await this.prisma.service.findFirst({
      where: { id: booking.serviceId },
    });
    const duration = service?.duration ?? 30;
    const newEndTime = this.calculateEndTime(newStartTime, duration);

    // Double-booking check (exclude current booking)
    const existingBookings = await this.prisma.booking.findMany({
      where: {
        practitionerId: booking.practitionerId,
        date: newDate,
        status: { in: ['pending', 'confirmed'] },
        deletedAt: null,
        id: { not: id },
      },
    });

    const hasConflict = existingBookings.some((existing) =>
      this.timeSlotsOverlap(
        newStartTime,
        newEndTime,
        existing.startTime,
        existing.endTime,
      ),
    );

    if (hasConflict) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Practitioner already has a booking at this time',
        error: 'BOOKING_CONFLICT',
      });
    }

    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        date: newDate,
        startTime: newStartTime,
        endTime: newEndTime,
      },
      include: bookingInclude,
    });

    return updated;
  }

  // ═══════════════════════════════════════════════════════════════
  //  CONFIRM (pending → confirmed)
  // ═══════════════════════════════════════════════════════════════

  async confirm(id: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, deletedAt: null },
    });
    if (!booking) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Booking not found',
        error: 'NOT_FOUND',
      });
    }

    if (booking.status !== 'pending') {
      throw new ConflictException({
        statusCode: 409,
        message: `Cannot confirm booking with status '${booking.status}'`,
        error: 'CONFLICT',
      });
    }

    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        status: 'confirmed',
        confirmedAt: new Date(),
      },
      include: bookingInclude,
    });

    return updated;
  }

  // ═══════════════════════════════════════════════════════════════
  //  COMPLETE (confirmed → completed)
  // ═══════════════════════════════════════════════════════════════

  async complete(id: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, deletedAt: null },
    });
    if (!booking) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Booking not found',
        error: 'NOT_FOUND',
      });
    }

    if (booking.status !== 'confirmed') {
      throw new ConflictException({
        statusCode: 409,
        message: `Cannot complete booking with status '${booking.status}'`,
        error: 'CONFLICT',
      });
    }

    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
      include: bookingInclude,
    });

    return updated;
  }

  // ═══════════════════════════════════════════════════════════════
  //  REQUEST CANCELLATION (confirmed → pending_cancellation)
  // ═══════════════════════════════════════════════════════════════

  async requestCancellation(
    id: string,
    patientId: string,
    reason?: string,
  ) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, deletedAt: null },
    });
    if (!booking) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Booking not found',
        error: 'NOT_FOUND',
      });
    }

    // Ownership check
    if (booking.patientId !== patientId) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'You can only request cancellation for your own bookings',
        error: 'FORBIDDEN',
      });
    }

    if (booking.status !== 'confirmed') {
      throw new ConflictException({
        statusCode: 409,
        message: `Cannot request cancellation for booking with status '${booking.status}'`,
        error: 'CONFLICT',
      });
    }

    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        status: 'pending_cancellation',
        cancellationReason: reason,
      },
      include: bookingInclude,
    });

    return updated;
  }

  // ═══════════════════════════════════════════════════════════════
  //  APPROVE CANCELLATION (pending_cancellation → cancelled)
  // ═══════════════════════════════════════════════════════════════

  async approveCancellation(id: string, dto: CancelApproveDto) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, deletedAt: null },
      include: { payment: true },
    });
    if (!booking) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Booking not found',
        error: 'NOT_FOUND',
      });
    }

    if (booking.status !== 'pending_cancellation') {
      throw new ConflictException({
        statusCode: 409,
        message: `Cannot approve cancellation for booking with status '${booking.status}'`,
        error: 'CONFLICT',
      });
    }

    // Run booking cancellation + optional payment refund in a transaction
    const updated = await this.prisma.$transaction(async (tx) => {
      const cancelledBooking = await tx.booking.update({
        where: { id },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
        },
        include: bookingInclude,
      });

      // If refundType !== 'none' and a paid payment exists, mark as refunded
      if (
        dto.refundType !== 'none' &&
        booking.payment &&
        booking.payment.status === 'paid'
      ) {
        await tx.payment.update({
          where: { id: booking.payment.id },
          data: { status: 'refunded' },
        });
      }

      return cancelledBooking;
    });

    return updated;
  }

  // ═══════════════════════════════════════════════════════════════
  //  REJECT CANCELLATION (pending_cancellation → confirmed)
  // ═══════════════════════════════════════════════════════════════

  async rejectCancellation(id: string, dto: CancelRejectDto) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, deletedAt: null },
    });
    if (!booking) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Booking not found',
        error: 'NOT_FOUND',
      });
    }

    if (booking.status !== 'pending_cancellation') {
      throw new ConflictException({
        statusCode: 409,
        message: `Cannot reject cancellation for booking with status '${booking.status}'`,
        error: 'CONFLICT',
      });
    }

    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        status: 'confirmed',
        cancellationReason: null,
      },
      include: bookingInclude,
    });

    return updated;
  }

  // ═══════════════════════════════════════════════════════════════
  //  FIND MY BOOKINGS (patient's own)
  // ═══════════════════════════════════════════════════════════════

  async findMyBookings(patientId: string) {
    const where = {
      patientId,
      deletedAt: null,
    };

    const [rawItems, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: bookingInclude,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.booking.count({ where }),
    ]);

    // Strip internal fields
    const items = rawItems.map(
      ({ deletedAt: _, zoomMeetingId: _z, ...item }) => item,
    );

    return {
      items,
      meta: {
        total,
        page: 1,
        perPage: total || 20,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  FIND TODAY BOOKINGS (practitioner's today)
  // ═══════════════════════════════════════════════════════════════

  async findTodayBookings(userId: string) {
    // Find practitioner by userId
    const practitioner = await this.prisma.practitioner.findFirst({
      where: { userId, deletedAt: null },
    });
    if (!practitioner) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Practitioner profile not found',
        error: 'NOT_FOUND',
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const rawItems = await this.prisma.booking.findMany({
      where: {
        practitionerId: practitioner.id,
        date: {
          gte: today,
          lt: tomorrow,
        },
        deletedAt: null,
      },
      include: bookingInclude,
      orderBy: { startTime: 'asc' },
    });

    // Strip internal fields
    const items = rawItems.map(
      ({ deletedAt: _, zoomMeetingId: _z, ...item }) => item,
    );

    return {
      items,
      meta: {
        total: items.length,
        page: 1,
        perPage: items.length || 20,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════════════════

  private calculateEndTime(startTime: string, durationMinutes: number): string {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
  }

  private timeSlotsOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string,
  ): boolean {
    const toMinutes = (time: string) => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    };
    const s1 = toMinutes(start1);
    const e1 = toMinutes(end1);
    const s2 = toMinutes(start2);
    const e2 = toMinutes(end2);
    return s1 < e2 && s2 < e1;
  }
}
