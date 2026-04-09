import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CacheService } from '../../common/services/cache.service.js';
import { CreateOfferingDto } from './dto/create-offering.dto.js';
import { UpdateOfferingDto } from './dto/update-offering.dto.js';
import { OfferingListQueryDto } from './dto/offering-list-query.dto.js';

@Injectable()
export class GroupSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async findAllOfferings(query: OfferingListQueryDto) {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where: Record<string, unknown> = { deletedAt: null };
    if (query.practitionerId) where.practitionerId = query.practitionerId;
    if (query.search) {
      where.OR = [
        { nameAr: { contains: query.search, mode: 'insensitive' } },
        { nameEn: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.groupOffering.findMany({
        where,
        include: {
          practitioner: { select: { id: true, nameAr: true } },
          _count: {
            select: {
              sessions: { where: { status: { in: ['open', 'confirmed', 'full'] } } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.groupOffering.count({ where }),
    ]);

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

  async findOneOffering(id: string) {
    const offering = await this.prisma.groupOffering.findFirst({
      where: { id, deletedAt: null },
      include: {
        practitioner: { select: { id: true, nameAr: true } },
        _count: {
          select: {
            sessions: { where: { status: { in: ['open', 'confirmed', 'full'] } } },
          },
        },
      },
    });

    if (!offering) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Group offering not found',
        error: 'NOT_FOUND',
      });
    }

    return offering;
  }

  async createOffering(dto: CreateOfferingDto) {
    if (dto.minParticipants > dto.maxParticipants) {
      throw new BadRequestException('minParticipants cannot exceed maxParticipants');
    }

    return this.prisma.groupOffering.create({
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        descriptionAr: dto.descriptionAr,
        descriptionEn: dto.descriptionEn,
        practitionerId: dto.practitionerId,
        minParticipants: dto.minParticipants,
        maxParticipants: dto.maxParticipants,
        pricePerPersonHalalat: dto.pricePerPersonHalalat,
        durationMin: dto.durationMin,
        paymentDeadlineHours: dto.paymentDeadlineHours ?? 48,
      },
    });
  }

  async updateOffering(id: string, dto: UpdateOfferingDto) {
    await this.findOneOffering(id);

    if (dto.minParticipants !== undefined && dto.maxParticipants !== undefined) {
      if (dto.minParticipants > dto.maxParticipants) {
        throw new BadRequestException('minParticipants cannot exceed maxParticipants');
      }
    }

    return this.prisma.groupOffering.update({
      where: { id },
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        descriptionAr: dto.descriptionAr,
        descriptionEn: dto.descriptionEn,
        practitionerId: dto.practitionerId,
        minParticipants: dto.minParticipants,
        maxParticipants: dto.maxParticipants,
        pricePerPersonHalalat: dto.pricePerPersonHalalat,
        durationMin: dto.durationMin,
        paymentDeadlineHours: dto.paymentDeadlineHours,
      },
    });
  }

  async removeOffering(id: string) {
    await this.findOneOffering(id);

    await this.prisma.groupOffering.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { deleted: true };
  }
}
