import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { checkOwnership } from '../../common/helpers/ownership.helper.js';
import { CreatePractitionerDto } from './dto/create-practitioner.dto.js';
import { UpdatePractitionerDto } from './dto/update-practitioner.dto.js';
import { SetAvailabilityDto } from './dto/set-availability.dto.js';
import { CreateVacationDto } from './dto/create-vacation.dto.js';
import { AssignPractitionerServiceDto } from './dto/assign-practitioner-service.dto.js';
import { UpdatePractitionerServiceDto } from './dto/update-practitioner-service.dto.js';
import { PractitionerAvailabilityService } from './practitioner-availability.service.js';
import { PractitionerVacationService } from './practitioner-vacation.service.js';
import { PractitionerServiceService } from './practitioner-service.service.js';
import { PractitionerRatingsService } from './practitioner-ratings.service.js';
import { PractitionerBreaksService } from './practitioner-breaks.service.js';
import { SetBreaksDto } from './dto/set-breaks.dto.js';
import { parsePaginationParams, buildPaginationMeta } from '../../common/helpers/pagination.helper.js';

@Injectable()
export class PractitionersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityService: PractitionerAvailabilityService,
    private readonly vacationService: PractitionerVacationService,
    private readonly practitionerServiceService: PractitionerServiceService,
    private readonly ratingsService: PractitionerRatingsService,
    private readonly breaksService: PractitionerBreaksService,
  ) {}

  /** Creates a practitioner profile for a new user. */
  async createForUser(userId: string): Promise<void> {
    const existing = await this.prisma.practitioner.findFirst({
      where: { userId },
    });
    if (existing) return;

    await this.prisma.practitioner.create({
      data: { userId },
    });
  }

  async findAll(params?: {
    page?: number;
    perPage?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    search?: string;
    specialty?: string;
    minRating?: number;
    isActive?: boolean;
    branchId?: string;
  }) {
    const { page, perPage, skip } = parsePaginationParams(params?.page, params?.perPage, 100);
    const allowedSortFields = ['rating', 'reviewCount', 'experience', 'createdAt'];
    const sortBy = allowedSortFields.includes(params?.sortBy ?? '') ? params!.sortBy! : 'rating';
    const sortOrder = params?.sortOrder ?? 'desc';

    const where: Record<string, unknown> = {
      deletedAt: null,
      isActive: params?.isActive ?? true,
    };

    if (params?.specialty) {
      where.OR = [
        { specialty: { contains: params.specialty, mode: 'insensitive' } },
        { specialtyAr: { contains: params.specialty, mode: 'insensitive' } },
      ];
    }

    if (params?.minRating !== undefined) {
      where.rating = { gte: params.minRating };
    }

    if (params?.branchId) {
      where.branches = { some: { branchId: params.branchId } };
    }

    if (params?.search) {
      where.user = {
        OR: [
          { firstName: { contains: params.search, mode: 'insensitive' } },
          { lastName: { contains: params.search, mode: 'insensitive' } },
        ],
      };
    }

    const include: Record<string, unknown> = {
      user: true,
      practitionerServices: { where: { isActive: true }, include: { service: { select: { id: true, nameAr: true, nameEn: true } } } },
    };
    // Only include branches when filtering by branch to avoid N+1
    if (params?.branchId) {
      include.branches = { include: { branch: { select: { id: true, nameAr: true, nameEn: true } } } };
    }

    const [practitioners, total] = await Promise.all([
      this.prisma.practitioner.findMany({
        where,
        include,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: perPage,
      }),
      this.prisma.practitioner.count({ where }),
    ]);

    return {
      items: practitioners,
      meta: buildPaginationMeta(total, page, perPage),
    };
  }

  async findOne(id: string) {
    const practitioner = await this.prisma.practitioner.findFirst({
      where: { id, deletedAt: null },
      include: { user: true },
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
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'User not found',
        error: 'USER_NOT_FOUND',
      });
    }

    const existing = await this.prisma.practitioner.findFirst({
      where: { userId: dto.userId },
    });

    if (existing) {
      if (!existing.bio && !existing.education && existing.deletedAt === null) {
        return this.prisma.practitioner.update({
          where: { id: existing.id },
          data: {
            specialty: dto.specialty,
            specialtyAr: dto.specialtyAr,
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
            user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
          },
        });
      }

      throw new ConflictException({
        statusCode: 409,
        message: 'Practitioner profile already exists for this user',
        error: 'PRACTITIONER_EXISTS',
      });
    }

    return this.prisma.practitioner.create({
      data: {
        userId: dto.userId,
        specialty: dto.specialty,
        specialtyAr: dto.specialtyAr,
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
        user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
      },
    });
  }

  async update(id: string, dto: UpdatePractitionerDto, currentUserId?: string) {
    let practitioner = await this.prisma.practitioner.findFirst({ where: { id } });
    if (!practitioner) {
      practitioner = await this.prisma.practitioner.findFirst({ where: { userId: id } });
    }
    if (!practitioner || practitioner.deletedAt) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Practitioner not found',
        error: 'PRACTITIONER_NOT_FOUND',
      });
    }

    if (currentUserId) {
      await checkOwnership(this.prisma,practitioner.userId, currentUserId);
    }

    return this.prisma.practitioner.update({
      where: { id: practitioner.id },
      data: {
        specialty: dto.specialty,
        specialtyAr: dto.specialtyAr,
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
        user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
      },
    });
  }

  async delete(id: string) {
    const practitioner = await this.prisma.practitioner.findFirst({ where: { id } });
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

  // --- Delegated: Availability ---

  async getAvailability(practitionerId: string) {
    return this.availabilityService.getAvailability(practitionerId);
  }

  async setAvailability(practitionerId: string, dto: SetAvailabilityDto, currentUserId?: string) {
    return this.availabilityService.setAvailability(practitionerId, dto, currentUserId);
  }

  async getSlots(practitionerId: string, date: string, duration?: number) {
    return this.availabilityService.getSlots(practitionerId, date, duration);
  }

  async getAvailableSlots(practitionerId: string, date: string, duration?: number) {
    return this.availabilityService.getAvailableSlots(practitionerId, date, duration);
  }

  /** Resolve duration from ServiceBookingType for slot generation. Falls back to 30 min. */
  async resolveDurationForSlots(serviceId: string, bookingType: string): Promise<number> {
    const sbt = await this.prisma.serviceBookingType.findUnique({
      where: { serviceId_bookingType: { serviceId, bookingType: bookingType as never } },
    });
    return sbt?.duration ?? 30;
  }

  // --- Delegated: Vacations ---

  async getVacations(practitionerId: string) {
    return this.vacationService.getVacations(practitionerId);
  }

  async listVacations(practitionerId: string) {
    return this.vacationService.listVacations(practitionerId);
  }

  async createVacation(practitionerId: string, dto: CreateVacationDto, currentUserId?: string) {
    return this.vacationService.createVacation(practitionerId, dto, currentUserId);
  }

  async deleteVacation(practitionerId: string, vacationId: string, currentUserId?: string) {
    return this.vacationService.deleteVacation(practitionerId, vacationId, currentUserId);
  }

  // --- Delegated: Breaks ---

  async getBreaks(practitionerId: string) {
    return this.breaksService.getBreaks(practitionerId);
  }

  async setBreaks(practitionerId: string, dto: SetBreaksDto, currentUserId?: string) {
    return this.breaksService.setBreaks(practitionerId, dto, currentUserId);
  }

  // --- Delegated: Ratings ---

  async getRatings(practitionerId: string, params?: { page?: number; perPage?: number }) {
    return this.ratingsService.getRatings(practitionerId, params);
  }

  // --- Delegated: Practitioner Services ---

  async assignService(practitionerId: string, dto: AssignPractitionerServiceDto, currentUserId?: string) {
    return this.practitionerServiceService.assignService(practitionerId, dto, currentUserId);
  }

  async listPractitionerServices(practitionerId: string) {
    return this.practitionerServiceService.listServices(practitionerId);
  }

  async updatePractitionerService(practitionerId: string, serviceId: string, dto: UpdatePractitionerServiceDto, currentUserId?: string) {
    return this.practitionerServiceService.updateService(practitionerId, serviceId, dto, currentUserId);
  }

  async removePractitionerService(practitionerId: string, serviceId: string, currentUserId?: string) {
    return this.practitionerServiceService.removeService(practitionerId, serviceId, currentUserId);
  }

  async getServiceTypes(practitionerId: string, serviceId: string) {
    return this.practitionerServiceService.getServiceTypes(practitionerId, serviceId);
  }
}
