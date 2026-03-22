import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CreatePractitionerDto } from './dto/create-practitioner.dto.js';
import { UpdatePractitionerDto } from './dto/update-practitioner.dto.js';
import { SetAvailabilityDto } from './dto/set-availability.dto.js';
import { CreateVacationDto } from './dto/create-vacation.dto.js';

const TIME_REGEX = /^\d{2}:\d{2}$/;

@Injectable()
export class PractitionersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params?: {
    page?: number;
    perPage?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    search?: string;
    specialtyId?: string;
    minRating?: number;
    isActive?: boolean;
  }) {
    const page = params?.page ?? 1;
    const perPage = Math.min(params?.perPage ?? 20, 100);
    const sortBy = params?.sortBy ?? 'rating';
    const sortOrder = params?.sortOrder ?? 'desc';

    const where: Record<string, unknown> = {
      deletedAt: null,
      isActive: params?.isActive ?? true,
    };

    if (params?.specialtyId) {
      where.specialtyId = params.specialtyId;
    }

    if (params?.minRating !== undefined) {
      where.rating = { gte: params.minRating };
    }

    if (params?.search) {
      where.user = {
        OR: [
          { firstName: { contains: params.search, mode: 'insensitive' } },
          { lastName: { contains: params.search, mode: 'insensitive' } },
        ],
      };
    }

    const [practitioners, total] = await Promise.all([
      this.prisma.practitioner.findMany({
        where,
        include: {
          user: true,
          specialty: true,
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.practitioner.count({ where }),
    ]);

    const totalPages = Math.ceil(total / perPage);

    return {
      items: practitioners,
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

  async findOne(id: string) {
    const practitioner = await this.prisma.practitioner.findFirst({
      where: { id, deletedAt: null },
      include: {
        user: true,
        specialty: true,
      },
    });

    if (!practitioner) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Practitioner not found',
        error: 'PRACTITIONER_NOT_FOUND',
      });
    }

    return practitioner;
  }

  async create(dto: CreatePractitionerDto) {
    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!user) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'User not found',
        error: 'USER_NOT_FOUND',
      });
    }

    // Verify specialty exists
    const specialty = await this.prisma.specialty.findUnique({
      where: { id: dto.specialtyId },
    });
    if (!specialty) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Specialty not found',
        error: 'SPECIALTY_NOT_FOUND',
      });
    }

    // Check if practitioner profile already exists for this user
    const existing = await this.prisma.practitioner.findFirst({
      where: { userId: dto.userId },
    });

    if (existing) {
      // If it was auto-created (no bio/education set), update it with full data
      if (!existing.bio && !existing.education && existing.deletedAt === null) {
        const updated = await this.prisma.practitioner.update({
          where: { id: existing.id },
          data: {
            specialtyId: dto.specialtyId,
            bio: dto.bio,
            bioAr: dto.bioAr,
            experience: dto.experience ?? 0,
            education: dto.education,
            educationAr: dto.educationAr,
            priceClinic: dto.priceClinic ?? 0,
            pricePhone: dto.pricePhone ?? 0,
            priceVideo: dto.priceVideo ?? 0,
          },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
            specialty: true,
          },
        });
        return updated;
      }

      throw new ConflictException({
        statusCode: 409,
        message: 'Practitioner profile already exists for this user',
        error: 'PRACTITIONER_EXISTS',
      });
    }

    const practitioner = await this.prisma.practitioner.create({
      data: {
        userId: dto.userId,
        specialtyId: dto.specialtyId,
        bio: dto.bio,
        bioAr: dto.bioAr,
        experience: dto.experience ?? 0,
        education: dto.education,
        educationAr: dto.educationAr,
        priceClinic: dto.priceClinic ?? 0,
        pricePhone: dto.pricePhone ?? 0,
        priceVideo: dto.priceVideo ?? 0,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
        specialty: true,
      },
    });

    return practitioner;
  }

  async update(id: string, dto: UpdatePractitionerDto, currentUserId?: string) {
    // Try to find by practitioner ID first, then by userId
    let practitioner = await this.prisma.practitioner.findFirst({
      where: { id },
    });
    if (!practitioner) {
      practitioner = await this.prisma.practitioner.findFirst({
        where: { userId: id },
      });
    }
    if (!practitioner || practitioner.deletedAt) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Practitioner not found',
        error: 'PRACTITIONER_NOT_FOUND',
      });
    }

    // Check ownership if currentUserId is provided
    if (currentUserId) {
      await this.checkOwnership(practitioner.userId, currentUserId);
    }

    // Validate specialty if updating
    if (dto.specialtyId) {
      const specialty = await this.prisma.specialty.findUnique({
        where: { id: dto.specialtyId },
      });
      if (!specialty) {
        throw new NotFoundException({
          statusCode: 404,
          message: 'Specialty not found',
          error: 'SPECIALTY_NOT_FOUND',
        });
      }
    }

    const updated = await this.prisma.practitioner.update({
      where: { id: practitioner.id },
      data: {
        specialtyId: dto.specialtyId,
        bio: dto.bio,
        bioAr: dto.bioAr,
        experience: dto.experience,
        education: dto.education,
        educationAr: dto.educationAr,
        priceClinic: dto.priceClinic,
        pricePhone: dto.pricePhone,
        priceVideo: dto.priceVideo,
        isActive: dto.isActive,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
        specialty: true,
      },
    });

    return updated;
  }

  async delete(id: string) {
    const practitioner = await this.prisma.practitioner.findFirst({
      where: { id },
    });
    if (!practitioner || practitioner.deletedAt) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Practitioner not found',
        error: 'PRACTITIONER_NOT_FOUND',
      });
    }

    await this.prisma.practitioner.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  /** Alias for delete — unit tests use softDelete */
  async softDelete(id: string) {
    return this.delete(id);
  }

  // --- Availability ---

  async getAvailability(practitionerId: string) {
    const practitioner = await this.prisma.practitioner.findFirst({
      where: { id: practitionerId },
    });
    if (!practitioner || practitioner.deletedAt) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Practitioner not found',
        error: 'PRACTITIONER_NOT_FOUND',
      });
    }

    return this.prisma.practitionerAvailability.findMany({
      where: { practitionerId, isActive: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async setAvailability(
    practitionerId: string,
    dto: SetAvailabilityDto,
    currentUserId?: string,
  ) {
    const practitioner = await this.prisma.practitioner.findFirst({
      where: { id: practitionerId },
    });
    if (!practitioner || practitioner.deletedAt) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Practitioner not found',
        error: 'PRACTITIONER_NOT_FOUND',
      });
    }

    // Check ownership if currentUserId is provided
    if (currentUserId) {
      await this.checkOwnership(practitioner.userId, currentUserId);
    }

    // Validate each slot
    for (const slot of dto.schedule) {
      // Validate dayOfWeek
      if (slot.dayOfWeek < 0 || slot.dayOfWeek > 6) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'dayOfWeek must be between 0 and 6',
          error: 'VALIDATION_ERROR',
        });
      }

      // Validate time format
      if (!TIME_REGEX.test(slot.startTime) || !TIME_REGEX.test(slot.endTime)) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'Time must be in HH:mm format',
          error: 'VALIDATION_ERROR',
        });
      }

      // Validate startTime < endTime
      if (slot.startTime >= slot.endTime) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'startTime must be before endTime',
          error: 'VALIDATION_ERROR',
        });
      }
    }

    // Check for overlapping time slots on same day
    const byDay = new Map<number, Array<{ startTime: string; endTime: string }>>();
    for (const slot of dto.schedule) {
      const daySlots = byDay.get(slot.dayOfWeek) ?? [];
      for (const existing of daySlots) {
        if (slot.startTime < existing.endTime && slot.endTime > existing.startTime) {
          throw new BadRequestException({
            statusCode: 400,
            message: 'Overlapping time slots on the same day',
            error: 'VALIDATION_ERROR',
          });
        }
      }
      daySlots.push({ startTime: slot.startTime, endTime: slot.endTime });
      byDay.set(slot.dayOfWeek, daySlots);
    }

    // Replace all availability records
    await this.prisma.practitionerAvailability.deleteMany({
      where: { practitionerId },
    });

    await this.prisma.practitionerAvailability.createMany({
      data: dto.schedule.map((slot) => ({
        practitionerId,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        isActive: slot.isActive ?? true,
      })),
    });

    return this.prisma.practitionerAvailability.findMany({
      where: { practitionerId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async getSlots(practitionerId: string, date: string, duration: number = 30) {
    if (!date) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'date query parameter is required',
        error: 'VALIDATION_ERROR',
      });
    }

    const practitioner = await this.prisma.practitioner.findFirst({
      where: { id: practitionerId },
    });
    if (!practitioner || practitioner.deletedAt) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Practitioner not found',
        error: 'PRACTITIONER_NOT_FOUND',
      });
    }

    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();

    // Get availability for this day
    const availabilities = await this.prisma.practitionerAvailability.findMany({
      where: {
        practitionerId,
        dayOfWeek,
        isActive: true,
      },
      orderBy: { startTime: 'asc' },
    });

    // Check for vacation on this date
    const vacation = await this.prisma.practitionerVacation.findFirst({
      where: {
        practitionerId,
        startDate: { lte: targetDate },
        endDate: { gte: targetDate },
      },
    });

    if (vacation) {
      return { date, practitionerId, slots: [] };
    }

    // Generate time slots from availability windows
    const slots: Array<{ startTime: string; endTime: string; available: boolean }> = [];

    for (const avail of availabilities) {
      const [startH, startM] = avail.startTime.split(':').map(Number);
      const [endH, endM] = avail.endTime.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      for (let m = startMinutes; m + duration <= endMinutes; m += duration) {
        const slotStart = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        const slotEnd = `${String(Math.floor((m + duration) / 60)).padStart(2, '0')}:${String((m + duration) % 60).padStart(2, '0')}`;
        slots.push({ startTime: slotStart, endTime: slotEnd, available: true });
      }
    }

    return { date, practitionerId, slots };
  }

  /** Alias for getSlots — unit tests use getAvailableSlots and expect array return */
  async getAvailableSlots(practitionerId: string, date: string, duration: number = 30) {
    const practitioner = await this.prisma.practitioner.findFirst({
      where: { id: practitionerId },
    });
    if (!practitioner || practitioner.deletedAt) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Practitioner not found',
        error: 'PRACTITIONER_NOT_FOUND',
      });
    }

    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();

    // Get availability for this day
    const availabilities = await this.prisma.practitionerAvailability.findMany({
      where: {
        practitionerId,
        dayOfWeek,
        isActive: true,
      },
      orderBy: { startTime: 'asc' },
    });

    // Check for vacation
    const vacations = await this.prisma.practitionerVacation.findMany({
      where: { practitionerId },
    });
    const isOnVacation = vacations.some((v: { startDate: Date; endDate: Date }) => {
      const start = new Date(v.startDate);
      const end = new Date(v.endDate);
      return targetDate >= start && targetDate <= end;
    });

    if (isOnVacation) {
      return [];
    }

    // Get existing bookings for this date
    const bookings = await this.prisma.booking.findMany({
      where: {
        practitionerId,
        status: { in: ['confirmed', 'pending'] },
      },
    });

    // Generate time slots from availability windows
    const slots: Array<{ startTime: string; endTime: string; available: boolean }> = [];

    for (const avail of availabilities) {
      const [startH, startM] = avail.startTime.split(':').map(Number);
      const [endH, endM] = avail.endTime.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      for (let m = startMinutes; m + duration <= endMinutes; m += duration) {
        const slotStart = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        const slotEnd = `${String(Math.floor((m + duration) / 60)).padStart(2, '0')}:${String((m + duration) % 60).padStart(2, '0')}`;

        // Check if this slot is booked
        const isBooked = bookings.some((b: { startTime: string; endTime: string }) =>
          b.startTime === slotStart && b.endTime === slotEnd,
        );

        if (!isBooked) {
          slots.push({ startTime: slotStart, endTime: slotEnd, available: true });
        }
      }
    }

    return slots;
  }

  // --- Vacations ---

  async getVacations(practitionerId: string) {
    const practitioner = await this.prisma.practitioner.findFirst({
      where: { id: practitionerId },
    });
    if (!practitioner || practitioner.deletedAt) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Practitioner not found',
        error: 'PRACTITIONER_NOT_FOUND',
      });
    }

    return this.prisma.practitionerVacation.findMany({
      where: { practitionerId },
      orderBy: { startDate: 'desc' },
    });
  }

  /** Alias for getVacations — unit tests use listVacations */
  async listVacations(practitionerId: string) {
    return this.getVacations(practitionerId);
  }

  async createVacation(
    practitionerId: string,
    dto: CreateVacationDto,
    currentUserId?: string,
  ) {
    const practitioner = await this.prisma.practitioner.findFirst({
      where: { id: practitionerId },
    });
    if (!practitioner || practitioner.deletedAt) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Practitioner not found',
        error: 'PRACTITIONER_NOT_FOUND',
      });
    }

    if (currentUserId) {
      await this.checkOwnership(practitioner.userId, currentUserId);
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    // Validate startDate < endDate
    if (startDate >= endDate) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'startDate must be before endDate',
        error: 'VALIDATION_ERROR',
      });
    }

    // Check for overlapping vacations
    const existingVacations = await this.prisma.practitionerVacation.findMany({
      where: { practitionerId },
    });

    const hasOverlap = existingVacations.some((v: { startDate: Date; endDate: Date }) => {
      const existStart = new Date(v.startDate);
      const existEnd = new Date(v.endDate);
      return startDate <= existEnd && endDate >= existStart;
    });

    if (hasOverlap) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Vacation period overlaps with an existing vacation',
        error: 'VALIDATION_ERROR',
      });
    }

    return this.prisma.practitionerVacation.create({
      data: {
        practitionerId,
        startDate,
        endDate,
        reason: dto.reason,
      },
    });
  }

  async deleteVacation(
    practitionerId: string,
    vacationId: string,
    currentUserId?: string,
  ) {
    const practitioner = await this.prisma.practitioner.findFirst({
      where: { id: practitionerId },
    });
    if (!practitioner || practitioner.deletedAt) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Practitioner not found',
        error: 'PRACTITIONER_NOT_FOUND',
      });
    }

    if (currentUserId) {
      await this.checkOwnership(practitioner.userId, currentUserId);
    }

    const vacation = await this.prisma.practitionerVacation.findUnique({
      where: { id: vacationId },
    });
    if (!vacation || vacation.practitionerId !== practitionerId) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Vacation not found',
        error: 'VACATION_NOT_FOUND',
      });
    }

    await this.prisma.practitionerVacation.delete({
      where: { id: vacationId },
    });
  }

  // --- Ratings ---

  async getRatings(practitionerId: string, params?: {
    page?: number;
    perPage?: number;
  }) {
    const practitioner = await this.prisma.practitioner.findUnique({
      where: { id: practitionerId },
    });
    if (!practitioner || practitioner.deletedAt) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Practitioner not found',
        error: 'PRACTITIONER_NOT_FOUND',
      });
    }

    const page = params?.page ?? 1;
    const perPage = Math.min(params?.perPage ?? 20, 100);

    const [ratings, total] = await Promise.all([
      this.prisma.rating.findMany({
        where: { practitionerId },
        include: {
          patient: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.rating.count({ where: { practitionerId } }),
    ]);

    const totalPages = Math.ceil(total / perPage);

    return {
      items: ratings,
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

  // --- Helpers ---

  private async checkOwnership(ownerUserId: string, currentUserId: string) {
    if (ownerUserId === currentUserId) return;

    const dbUser = await this.prisma.user.findUnique({
      where: { id: currentUserId },
      include: { userRoles: { include: { role: true } } },
    });

    const roles = dbUser?.userRoles.map((ur: { role: { slug: string } }) => ur.role.slug) ?? [];
    const isAdmin = roles.includes('super_admin') || roles.includes('receptionist');

    if (!isAdmin) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'You can only edit your own profile',
        error: 'FORBIDDEN',
      });
    }
  }
}
