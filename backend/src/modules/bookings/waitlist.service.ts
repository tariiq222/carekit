import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { BookingSettingsService } from './booking-settings.service.js';
import { JoinWaitlistDto } from './dto/join-waitlist.dto.js';
import { NOTIF } from '../../common/constants/notification-messages.js';

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly bookingSettingsService: BookingSettingsService,
  ) {}

  // ───────────────────────────────────────────────────────────────
  //  Join waitlist
  // ───────────────────────────────────────────────────────────────

  async join(patientId: string, dto: JoinWaitlistDto) {
    const settings = await this.bookingSettingsService.get();
    if (!settings.waitlistEnabled) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Waitlist is not enabled',
        error: 'WAITLIST_NOT_ENABLED',
      });
    }

    const existingCount = await this.prisma.waitlistEntry.count({
      where: {
        practitionerId: dto.practitionerId,
        status: 'waiting',
        ...(dto.preferredDate
          ? { preferredDate: new Date(dto.preferredDate) }
          : {}),
      },
    });
    if (existingCount >= settings.waitlistMaxPerSlot) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Waitlist is full for this slot',
        error: 'WAITLIST_FULL',
      });
    }

    const existing = await this.prisma.waitlistEntry.findFirst({
      where: {
        patientId,
        practitionerId: dto.practitionerId,
        status: 'waiting',
      },
    });
    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Already on the waitlist for this practitioner',
        error: 'ALREADY_ON_WAITLIST',
      });
    }

    return this.prisma.waitlistEntry.create({
      data: {
        patientId,
        practitionerId: dto.practitionerId,
        serviceId: dto.serviceId,
        preferredDate: dto.preferredDate
          ? new Date(dto.preferredDate)
          : null,
        preferredTime: dto.preferredTime,
      },
    });
  }

  // ───────────────────────────────────────────────────────────────
  //  Leave waitlist
  // ───────────────────────────────────────────────────────────────

  async leave(entryId: string, patientId: string) {
    const entry = await this.prisma.waitlistEntry.findFirst({
      where: { id: entryId, patientId, status: 'waiting' },
    });
    if (!entry) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Waitlist entry not found',
        error: 'NOT_FOUND',
      });
    }
    return this.prisma.waitlistEntry.update({
      where: { id: entryId },
      data: { status: 'cancelled' },
    });
  }

  // ───────────────────────────────────────────────────────────────
  //  Patient's own entries
  // ───────────────────────────────────────────────────────────────

  async findMyEntries(patientId: string) {
    return this.prisma.waitlistEntry.findMany({
      where: { patientId, status: { in: ['waiting', 'notified'] } },
      include: {
        practitioner: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        service: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ───────────────────────────────────────────────────────────────
  //  Admin: list all entries
  // ───────────────────────────────────────────────────────────────

  async findAll(query?: { practitionerId?: string; status?: string }) {
    return this.prisma.waitlistEntry.findMany({
      where: {
        ...(query?.practitionerId
          ? { practitionerId: query.practitionerId }
          : {}),
        ...(query?.status ? { status: query.status as never } : {}),
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        practitioner: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        service: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ───────────────────────────────────────────────────────────────
  //  Notify waitlisted patients when a slot opens
  // ───────────────────────────────────────────────────────────────

  async checkAndNotify(practitionerId: string, date: Date) {
    const settings = await this.bookingSettingsService.get();
    if (!settings.waitlistEnabled || !settings.waitlistAutoNotify) return;

    const dateStr = date.toISOString().split('T')[0];
    const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
    const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);

    const entries = await this.prisma.waitlistEntry.findMany({
      where: {
        practitionerId,
        status: 'waiting',
        OR: [
          { preferredDate: { gte: dayStart, lte: dayEnd } },
          { preferredDate: null },
        ],
      },
      include: {
        practitioner: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 3,
    });

    for (const entry of entries) {
      const docName = `${entry.practitioner.user.firstName} ${entry.practitioner.user.lastName}`;

      await this.prisma.waitlistEntry.update({
        where: { id: entry.id },
        data: { status: 'notified', notifiedAt: new Date() },
      });

      await this.notificationsService.createNotification({
        userId: entry.patientId,
        ...NOTIF.WAITLIST_SLOT_AVAILABLE,
        bodyAr: `تحرّر موعد مع د. ${docName} بتاريخ ${dateStr}. احجز الآن!`,
        bodyEn: `A slot opened with Dr. ${docName} on ${dateStr}. Book now!`,
        type: 'waitlist_slot_available',
        data: { practitionerId, date: dateStr },
      });
    }

    if (entries.length > 0) {
      this.logger.log(
        `Notified ${entries.length} waitlist entries for practitioner ${practitionerId}`,
      );
    }
  }
}
