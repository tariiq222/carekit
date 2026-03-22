import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { CreateServiceDto } from './dto/create-service.dto.js';
import { UpdateServiceDto } from './dto/update-service.dto.js';

interface ServiceListQuery {
  page?: number;
  perPage?: number;
  categoryId?: string;
  isActive?: boolean;
  search?: string;
}

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════
  //  SERVICE CATEGORIES
  // ═══════════════════════════════════════════════════════════════

  async createCategory(dto: CreateCategoryDto) {
    return this.prisma.serviceCategory.create({
      data: {
        nameEn: dto.nameEn,
        nameAr: dto.nameAr,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async findAllCategories() {
    return this.prisma.serviceCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
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

    return this.prisma.serviceCategory.update({
      where: { id },
      data: {
        nameEn: dto.nameEn,
        nameAr: dto.nameAr,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
    });
  }

  async deleteCategory(id: string) {
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

    // Cascade protection: check for assigned services
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
    return { deleted: true };
  }

  // ═══════════════════════════════════════════════════════════════
  //  SERVICES
  // ═══════════════════════════════════════════════════════════════

  async create(dto: CreateServiceDto) {
    // Validate category exists
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Category not found',
        error: 'NOT_FOUND',
      });
    }

    return this.prisma.service.create({
      data: {
        nameEn: dto.nameEn,
        nameAr: dto.nameAr,
        descriptionEn: dto.descriptionEn,
        descriptionAr: dto.descriptionAr,
        categoryId: dto.categoryId,
        price: dto.price ?? 0,
        duration: dto.duration ?? 30,
      },
      include: { category: true },
    });
  }

  async findAll(query: ServiceListQuery) {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.search) {
      where.OR = [
        { nameEn: { contains: query.search, mode: 'insensitive' } },
        { nameAr: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [rawItems, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        include: { category: true },
        orderBy: { createdAt: 'asc' },
        skip,
        take: perPage,
      }),
      this.prisma.service.count({ where }),
    ]);

    // Strip deletedAt from public response
    const items = rawItems.map(({ deletedAt: _, ...item }) => item);

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
    const service = await this.prisma.service.findFirst({
      where: { id, deletedAt: null },
      include: { category: true },
    });
    if (!service) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Service not found',
        error: 'NOT_FOUND',
      });
    }
    return service;
  }

  async update(id: string, dto: UpdateServiceDto) {
    const service = await this.prisma.service.findFirst({
      where: { id, deletedAt: null },
    });
    if (!service) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Service not found',
        error: 'NOT_FOUND',
      });
    }

    // Validate new category if changing
    if (dto.categoryId) {
      const category = await this.prisma.serviceCategory.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new NotFoundException({
          statusCode: 404,
          message: 'Category not found',
          error: 'NOT_FOUND',
        });
      }
    }

    return this.prisma.service.update({
      where: { id },
      data: {
        nameEn: dto.nameEn,
        nameAr: dto.nameAr,
        descriptionEn: dto.descriptionEn,
        descriptionAr: dto.descriptionAr,
        categoryId: dto.categoryId,
        price: dto.price,
        duration: dto.duration,
        isActive: dto.isActive,
      },
      include: { category: true },
    });
  }

  async softDelete(id: string) {
    const service = await this.prisma.service.findFirst({
      where: { id, deletedAt: null },
    });
    if (!service) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Service not found',
        error: 'NOT_FOUND',
      });
    }

    await this.prisma.service.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { deleted: true };
  }
}
