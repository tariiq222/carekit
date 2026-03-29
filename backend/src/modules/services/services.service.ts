import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Prisma, RecurringPattern } from '@prisma/client';
import { CacheService } from '../../common/services/cache.service.js';
import { CACHE_TTL, CACHE_KEYS } from '../../config/constants.js';
import { parsePaginationParams, buildPaginationMeta } from '../../common/helpers/pagination.helper.js';
import { CreateServiceDto } from './dto/create-service.dto.js';
import { UpdateServiceDto } from './dto/update-service.dto.js';
import { IntakeFormsService } from '../intake-forms/intake-forms.service.js';
interface ServiceListQuery {
  page?: number;
  perPage?: number;
  categoryId?: string;
  isActive?: boolean;
  includeHidden?: boolean;
  search?: string;
  branchId?: string;
}

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly intakeForms: IntakeFormsService,
  ) {}

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

    const serviceData = {
      nameEn: dto.nameEn,
      nameAr: dto.nameAr,
      descriptionEn: dto.descriptionEn,
      descriptionAr: dto.descriptionAr,
      categoryId: dto.categoryId,
      price: dto.price ?? 0,
      duration: dto.duration ?? 30,
      isActive: dto.isActive ?? true,
      isHidden: dto.isHidden ?? false,
      hidePriceOnBooking: dto.hidePriceOnBooking ?? false,
      hideDurationOnBooking: dto.hideDurationOnBooking ?? false,
      calendarColor: dto.calendarColor,
      iconName: dto.iconName ?? null,
      iconBgColor: dto.iconBgColor ?? null,
      imageUrl: dto.imageUrl ?? null,
      bufferMinutes: dto.bufferMinutes ?? 0,
      depositEnabled: dto.depositEnabled ?? false,
      depositPercent: dto.depositPercent,
      allowRecurring: dto.allowRecurring,
      allowedRecurringPatterns: dto.allowedRecurringPatterns as RecurringPattern[] | undefined,
      maxRecurrences: dto.maxRecurrences,
      maxParticipants: dto.maxParticipants ?? 1,
      minLeadMinutes: dto.minLeadMinutes,
      maxAdvanceDays: dto.maxAdvanceDays,
    };

    const service = await this.prisma.service.create({
      data: {
        ...serviceData,
        ...(dto.practitionerIds?.length && {
          practitionerServices: {
            create: dto.practitionerIds.map((practitionerId) => ({ practitionerId })),
          },
        }),
      },
      include: { category: true },
    });

    await this.invalidateServicesCache();
    return service;
  }

  async findAll(query: ServiceListQuery) {
    // Only cache the default active-services query (no filters, no search, page 1)
    const isDefaultQuery =
      !query.categoryId &&
      !query.search &&
      !query.branchId &&
      (query.isActive === undefined || query.isActive === true) &&
      (query.page === undefined || query.page === 1) &&
      query.perPage === undefined;

    if (isDefaultQuery) {
      const cached = await this.cache.get<ReturnType<typeof this.buildFindAllResult>>(
        CACHE_KEYS.SERVICES_ACTIVE,
      );
      if (cached) return cached;
    }

    const result = await this.queryServices(query);

    if (isDefaultQuery) {
      await this.cache.set(
        CACHE_KEYS.SERVICES_ACTIVE,
        result,
        CACHE_TTL.SERVICES_LIST,
      );
    }

    return result;
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

    const updated = await this.prisma.service.update({
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
        isHidden: dto.isHidden,
        hidePriceOnBooking: dto.hidePriceOnBooking,
        hideDurationOnBooking: dto.hideDurationOnBooking,
        calendarColor: dto.calendarColor,
        ...(dto.iconName !== undefined && { iconName: dto.iconName }),
        ...(dto.iconBgColor !== undefined && { iconBgColor: dto.iconBgColor }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        bufferMinutes: dto.bufferMinutes,
        depositEnabled: dto.depositEnabled,
        depositPercent: dto.depositPercent,
        allowRecurring: dto.allowRecurring,
        allowedRecurringPatterns: dto.allowedRecurringPatterns,
        maxRecurrences: dto.maxRecurrences,
        maxParticipants: dto.maxParticipants,
        minLeadMinutes: dto.minLeadMinutes,
        maxAdvanceDays: dto.maxAdvanceDays,
      },
      include: { category: true },
    });
    await this.invalidateServicesCache();
    return updated;
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

    await this.invalidateServicesCache();
    return { deleted: true };
  }

  async setBranches(id: string, branchIds: string[]): Promise<void> {
    const service = await this.prisma.service.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!service) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Service not found',
        error: 'NOT_FOUND',
      });
    }

    await this.prisma.$transaction([
      this.prisma.serviceBranch.deleteMany({ where: { serviceId: id } }),
      this.prisma.serviceBranch.createMany({
        data: branchIds.map((branchId) => ({ serviceId: id, branchId })),
        skipDuplicates: true,
      }),
    ]);

    await this.invalidateServicesCache();
  }

  async clearBranches(id: string): Promise<void> {
    const service = await this.prisma.service.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!service) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Service not found',
        error: 'NOT_FOUND',
      });
    }

    await this.prisma.serviceBranch.deleteMany({ where: { serviceId: id } });
    await this.invalidateServicesCache();
  }

  async getIntakeForms(serviceId: string) {
    return this.intakeForms.listForms({ serviceId });
  }

  // ═══════════════════════════════════════════════════════════════
  //  PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════

  private async queryServices(query: ServiceListQuery) {
    const { page, perPage, skip } = parsePaginationParams(query.page, query.perPage);

    const where: Prisma.ServiceWhereInput = {
      deletedAt: null,
      isActive: query.isActive ?? true,
      ...(!query.includeHidden && { isHidden: false }),
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.search && {
        OR: [
          { nameEn: { contains: query.search, mode: 'insensitive' } },
          { nameAr: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
      ...(query.branchId && {
        OR: [
          { branches: { none: {} } },
          { branches: { some: { branchId: query.branchId } } },
        ],
      }),
    };

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

    return this.buildFindAllResult(rawItems, total, page, perPage);
  }

  private buildFindAllResult(
    rawItems: Awaited<ReturnType<typeof this.prisma.service.findMany>>,
    total: number,
    page: number,
    perPage: number,
  ) {
    const items = rawItems.map(({ deletedAt: _, ...item }) => item);
    return {
      items,
      meta: buildPaginationMeta(total, page, perPage),
    };
  }

  async ensureExists(id: string): Promise<void> {
    const service = await this.prisma.service.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!service) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Service not found',
        error: 'NOT_FOUND',
      });
    }
  }

  async invalidateServicesCache(): Promise<void> {
    await this.cache.del(CACHE_KEYS.SERVICES_ACTIVE);
  }
}
