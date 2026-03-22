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

@Injectable()
export class PractitionersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityService: PractitionerAvailabilityService,
    private readonly vacationService: PractitionerVacationService,
    private readonly practitionerServiceService: PractitionerServiceService,
  ) {}

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
    const allowedSortFields = ['rating', 'reviewCount', 'experience', 'createdAt'];
    const sortBy = allowedSortFields.includes(params?.sortBy ?? '') ? params!.sortBy! : 'rating';
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
        include: { user: true, specialty: true, practitionerServices: { where: { isActive: true }, include: { service: { select: { id: true, nameAr: true, nameEn: true } } } } },
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
      include: { user: true, specialty: true },
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

    const specialty = await this.prisma.specialty.findUnique({ where: { id: dto.specialtyId } });
    if (!specialty) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Specialty not found',
        error: 'SPECIALTY_NOT_FOUND',
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
            user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
            specialty: true,
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
        user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
        specialty: true,
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

    if (dto.specialtyId) {
      const specialty = await this.prisma.specialty.findUnique({ where: { id: dto.specialtyId } });
      if (!specialty) {
        throw new NotFoundException({
          statusCode: 404,
          message: 'Specialty not found',
          error: 'SPECIALTY_NOT_FOUND',
        });
      }
    }

    return this.prisma.practitioner.update({
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
        user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
        specialty: true,
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

  // --- Ratings ---

  async getRatings(practitionerId: string, params?: { page?: number; perPage?: number }) {
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

    const [rawRatings, total] = await Promise.all([
      this.prisma.rating.findMany({
        where: { practitionerId },
        include: {
          patient: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.rating.count({ where: { practitionerId } }),
    ]);

    // Anonymize patient names in public endpoint: "أحمد م."
    const ratings = rawRatings.map(({ patient, ...rating }) => ({
      ...rating,
      patient: patient
        ? { firstName: patient.firstName, lastName: patient.lastName.charAt(0) + '.' }
        : null,
    }));

    const totalPages = Math.ceil(total / perPage);

    return {
      items: ratings,
      meta: { total, page, perPage, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 },
    };
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
}
