import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CacheService } from '../../common/services/cache.service.js';
import { CACHE_TTL, CACHE_KEYS } from '../../config/constants.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

@Injectable()
export class ServiceCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async create(dto: CreateCategoryDto) {
    const category = await this.prisma.serviceCategory.create({
      data: {
        nameEn: dto.nameEn,
        nameAr: dto.nameAr,
        sortOrder: dto.sortOrder ?? 0,
        departmentId: dto.departmentId,
      },
    });
    await this.invalidateCache();
    return category;
  }

  async findAll() {
    try {
      const cached = await this.cache.get<
        Awaited<ReturnType<typeof this.prisma.serviceCategory.findMany>>
      >(CACHE_KEYS.CATEGORIES_ACTIVE);
      if (cached) return cached;
    } catch {
      // Cache read failure — fall through to DB
    }

    const categories = await this.prisma.serviceCategory.findMany({
      where: { isActive: true },
      include: {
        department: { select: { id: true, nameEn: true, nameAr: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });

    try {
      await this.cache.set(
        CACHE_KEYS.CATEGORIES_ACTIVE,
        categories,
        CACHE_TTL.CATEGORIES_LIST,
      );
    } catch {
      // Cache write failure is non-fatal
    }

    return categories;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Category not found',
        error: 'NOT_FOUND',
      });
    }

    const updated = await this.prisma.serviceCategory.update({
      where: { id },
      data: {
        nameEn: dto.nameEn,
        nameAr: dto.nameAr,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
        departmentId: dto.departmentId,
      },
    });
    await this.invalidateCache();
    return updated;
  }

  async delete(id: string) {
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Category not found',
        error: 'NOT_FOUND',
      });
    }

    // Only block on active (non-soft-deleted) services
    const serviceCount = await this.prisma.service.count({
      where: { categoryId: id, deletedAt: null },
    });
    if (serviceCount > 0) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Cannot delete category with assigned services',
        error: 'CONFLICT',
      });
    }

    await this.prisma.serviceCategory.delete({ where: { id } });
    await this.invalidateCache();
    return { deleted: true };
  }

  private async invalidateCache(): Promise<void> {
    try {
      await Promise.all([
        this.cache.del(CACHE_KEYS.CATEGORIES_ACTIVE),
        this.cache.del(CACHE_KEYS.SERVICES_ACTIVE),
      ]);
    } catch {
      // Cache invalidation failure is non-fatal
    }
  }
}
