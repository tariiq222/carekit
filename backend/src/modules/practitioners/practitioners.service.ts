import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { BookingType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { checkOwnership } from '../../common/helpers/ownership.helper.js';
import { CreatePractitionerDto } from './dto/create-practitioner.dto.js';
import { UpdatePractitionerDto } from './dto/update-practitioner.dto.js';
import { parsePaginationParams, buildPaginationMeta } from '../../common/helpers/pagination.helper.js';
import { PriceResolverService } from '../bookings/price-resolver.service.js';

@Injectable()
export class PractitionersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly priceResolver: PriceResolverService,
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
    specialtyId?: string;
    minRating?: number;
    isActive?: boolean;
    branchId?: string;
    serviceId?: string;
  }) {
    const { page, perPage, skip } = parsePaginationParams(params?.page, params?.perPage, 100);
    const allowedSortFields = ['rating', 'reviewCount', 'experience', 'createdAt'];
    const sortBy = allowedSortFields.includes(params?.sortBy ?? '') ? params!.sortBy! : 'rating';
    const sortOrder = params?.sortOrder ?? 'desc';

    const where: Record<string, unknown> = {
      deletedAt: null,
      isActive: params?.isActive ?? true,
    };

    if (params?.specialtyId) {
      where.specialtyId = params.specialtyId;
    } else if (params?.specialty) {
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

    if (params?.serviceId) {
      where.practitionerServices = { some: { serviceId: params.serviceId } };
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
      specialtyRel: { select: { id: true, nameEn: true, nameAr: true } },
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
      items: practitioners.map(this.mapSpecialtyRelation),
      meta: buildPaginationMeta(total, page, perPage),
    };
  }

  async findOne(id: string) {
    const practitioner = await this.prisma.practitioner.findFirst({
      where: { id, deletedAt: null },
      include: {
        user: true,
        specialtyRel: { select: { id: true, nameEn: true, nameAr: true } },
      },
    });

    if (!practitioner) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Practitioner not found',
        error: 'PRACTITIONER_NOT_FOUND',
      });
    }

    return this.mapSpecialtyRelation(practitioner);
  }

  /**
   * Renames specialtyRel → specialty in the API response so callers get
   * { specialty: { id, nameEn, nameAr } } instead of the raw relation name.
   */
  private mapSpecialtyRelation<T extends { specialtyRel?: unknown; specialty?: unknown }>(
    practitioner: T,
  ): Omit<T, 'specialtyRel' | 'specialty'> & { specialty: unknown } {
    const { specialtyRel, specialty: _stringSpecialty, ...rest } = practitioner;
    return { ...rest, specialty: specialtyRel ?? null };
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

    // Resolve specialty names from specialtyId when provided
    let resolvedSpecialty = dto.specialty ?? '';
    let resolvedSpecialtyAr = dto.specialtyAr ?? '';
    let resolvedSpecialtyId = dto.specialtyId;

    if (dto.specialtyId) {
      const specialtyRecord = await this.prisma.specialty.findUnique({
        where: { id: dto.specialtyId },
      });
      if (!specialtyRecord) {
        throw new NotFoundException({
          statusCode: 404,
          message: 'Specialty not found',
          error: 'SPECIALTY_NOT_FOUND',
        });
      }
      resolvedSpecialty = specialtyRecord.nameEn;
      resolvedSpecialtyAr = specialtyRecord.nameAr;
      resolvedSpecialtyId = specialtyRecord.id;
    }

    const existing = await this.prisma.practitioner.findFirst({
      where: { userId: dto.userId },
    });

    if (existing) {
      if (!existing.bio && !existing.education && existing.deletedAt === null) {
        return this.prisma.practitioner.update({
          where: { id: existing.id },
          data: {
            specialtyId: resolvedSpecialtyId,
            specialty: resolvedSpecialty,
            specialtyAr: resolvedSpecialtyAr,
            bio: dto.bio,
            bioAr: dto.bioAr,
            experience: dto.experience ?? 0,
            education: dto.education,
            educationAr: dto.educationAr,
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
        specialtyId: resolvedSpecialtyId,
        specialty: resolvedSpecialty,
        specialtyAr: resolvedSpecialtyAr,
        bio: dto.bio,
        bioAr: dto.bioAr,
        experience: dto.experience ?? 0,
        education: dto.education,
        educationAr: dto.educationAr,
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
        title: dto.title,
        nameAr: dto.nameAr,
        specialty: dto.specialty,
        specialtyAr: dto.specialtyAr,
        bio: dto.bio,
        bioAr: dto.bioAr,
        experience: dto.experience,
        education: dto.education,
        educationAr: dto.educationAr,
        isActive: dto.isActive,
        isAcceptingBookings: dto.isAcceptingBookings,
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

  /**
   * Resolves the correct slot duration for a given service + bookingType combination.
   * Uses the full PriceResolverService chain:
   *   practitioner duration option → service duration option → practitioner type → service type
   * This ensures slot generation uses the exact same duration as booking creation,
   * preventing slot/booking duration mismatch (CRITICAL fix #1).
   *
   * Falls back to 30 if the service or practitioner relation is not found
   * (e.g. public slot browsing before selecting a practitioner).
   */
  async resolveDurationForSlots(
    serviceId: string,
    bookingType: string,
    practitionerId?: string,
  ): Promise<number> {
    try {
      if (!practitionerId) {
        // No practitioner context — resolve from service-level only
        const sbt = await this.prisma.serviceBookingType.findUnique({
          where: { serviceId_bookingType: { serviceId, bookingType: bookingType as BookingType } },
          include: { durationOptions: { where: { isDefault: true }, take: 1 } },
        });
        if (!sbt) return 30;
        if (sbt.durationOptions.length > 0) return sbt.durationOptions[0].durationMinutes;
        return sbt.duration;
      }

      const ps = await this.prisma.practitionerService.findUnique({
        where: { practitionerId_serviceId: { practitionerId, serviceId } },
        select: { id: true },
      });
      if (!ps) {
        // Practitioner doesn't offer this service — fall back to service-level
        const sbt = await this.prisma.serviceBookingType.findUnique({
          where: { serviceId_bookingType: { serviceId, bookingType: bookingType as BookingType } },
          include: { durationOptions: { where: { isDefault: true }, take: 1 } },
        });
        if (!sbt) return 30;
        if (sbt.durationOptions.length > 0) return sbt.durationOptions[0].durationMinutes;
        return sbt.duration;
      }

      const resolved = await this.priceResolver.resolve({
        serviceId,
        practitionerServiceId: ps.id,
        bookingType: bookingType as BookingType,
      });
      return resolved.duration;
    } catch {
      // Non-blocking — return safe default rather than breaking slot availability
      return 30;
    }
  }

}
