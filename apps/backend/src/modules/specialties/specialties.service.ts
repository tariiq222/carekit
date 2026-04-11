import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateSpecialtyDto } from './dto/create-specialty.dto.js';
import { UpdateSpecialtyDto } from './dto/update-specialty.dto.js';

@Injectable()
export class SpecialtiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.specialty.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(id: string) {
    const specialty = await this.prisma.specialty.findUnique({
      where: { id },
    });
    if (!specialty) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Specialty not found',
        error: 'NOT_FOUND',
      });
    }
    return specialty;
  }

  async create(dto: CreateSpecialtyDto) {
    // Check for duplicate nameEn
    const existing = await this.prisma.specialty.findUnique({
      where: { nameEn: dto.nameEn },
    });
    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        message: 'A specialty with this name already exists',
        error: 'CONFLICT',
      });
    }

    return this.prisma.specialty.create({
      data: {
        nameEn: dto.nameEn,
        nameAr: dto.nameAr,
        descriptionEn: dto.descriptionEn,
        descriptionAr: dto.descriptionAr,
        iconUrl: dto.iconUrl,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateSpecialtyDto) {
    const specialty = await this.prisma.specialty.findUnique({
      where: { id },
    });
    if (!specialty) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Specialty not found',
        error: 'NOT_FOUND',
      });
    }

    // Check for duplicate nameEn if changing
    if (dto.nameEn && dto.nameEn !== specialty.nameEn) {
      const existing = await this.prisma.specialty.findUnique({
        where: { nameEn: dto.nameEn },
      });
      if (existing) {
        throw new ConflictException({
          statusCode: 409,
          message: 'A specialty with this name already exists',
          error: 'CONFLICT',
        });
      }
    }

    return this.prisma.specialty.update({
      where: { id },
      data: {
        nameEn: dto.nameEn,
        nameAr: dto.nameAr,
        descriptionEn: dto.descriptionEn,
        descriptionAr: dto.descriptionAr,
        iconUrl: dto.iconUrl,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
    });
  }

  async delete(id: string) {
    const specialty = await this.prisma.specialty.findUnique({
      where: { id },
      include: { practitioners: { where: { deletedAt: null }, take: 1 } },
    });
    if (!specialty) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Specialty not found',
        error: 'NOT_FOUND',
      });
    }

    if (specialty.practitioners.length > 0) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Cannot delete specialty with active practitioners',
        error: 'CONFLICT',
      });
    }

    await this.prisma.specialty.delete({ where: { id } });

    return { deleted: true };
  }
}
