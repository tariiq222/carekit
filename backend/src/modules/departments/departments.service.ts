import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CacheService } from '../../common/services/cache.service.js';
import { CACHE_KEYS } from '../../config/constants.js';
import { CreateDepartmentDto } from './dto/create-department.dto.js';
import { UpdateDepartmentDto } from './dto/update-department.dto.js';
import { ReorderDepartmentsDto } from './dto/reorder-departments.dto.js';
import { DepartmentListQueryDto } from './dto/department-list-query.dto.js';

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async findAll(query: DepartmentListQueryDto) {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where: Record<string, unknown> = { deletedAt: null };
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.search) {
      where.OR = [
        { nameAr: { contains: query.search, mode: 'insensitive' } },
        { nameEn: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.department.findMany({
        where,
        include: {
          _count: { select: { categories: { where: { isActive: true } } } },
        },
        orderBy: { sortOrder: 'asc' },
        skip,
        take: perPage,
      }),
      this.prisma.department.count({ where }),
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

  async findOne(id: string) {
    const department = await this.prisma.department.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: { select: { categories: { where: { isActive: true } } } },
      },
    });

    if (!department) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Department not found',
        error: 'NOT_FOUND',
      });
    }

    return department;
  }

  async create(dto: CreateDepartmentDto) {
    const department = await this.prisma.department.create({
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        descriptionAr: dto.descriptionAr,
        descriptionEn: dto.descriptionEn,
        icon: dto.icon,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });

    await this.invalidateCache();
    return department;
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    await this.findOne(id);

    const updated = await this.prisma.department.update({
      where: { id },
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        descriptionAr: dto.descriptionAr,
        descriptionEn: dto.descriptionEn,
        icon: dto.icon,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
    });

    await this.invalidateCache();
    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.department.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.invalidateCache();
    return { deleted: true };
  }

  async reorder(dto: ReorderDepartmentsDto) {
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.department.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );

    await this.invalidateCache();
    return { reordered: true };
  }

  private async invalidateCache(): Promise<void> {
    await this.cache.del(CACHE_KEYS.DEPARTMENTS_ACTIVE);
  }
}
