import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import {
  parsePaginationParams,
  buildPaginationMeta,
} from '../../common/helpers/pagination.helper.js';
import { CreateBranchDto } from './dto/create-branch.dto.js';
import { UpdateBranchDto } from './dto/update-branch.dto.js';
import { BranchFilterDto } from './dto/branch-filter.dto.js';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════
  //  PUBLIC LIST (no auth — widget use)
  // ═══════════════════════════════════════════════════════════════

  async getPublicBranches(): Promise<
    Array<{
      id: string;
      nameAr: string;
      nameEn: string;
      address: string | null;
      phone: string | null;
    }>
  > {
    return this.prisma.branch.findMany({
      where: { isActive: true, deletedAt: null },
      select: {
        id: true,
        nameAr: true,
        nameEn: true,
        address: true,
        phone: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ═══════════════════════════════════════════════════════════════
  //  LIST (paginated, search, filter)
  // ═══════════════════════════════════════════════════════════════

  async findAll(query: BranchFilterDto) {
    const { page, perPage, skip } = parsePaginationParams(
      query.page,
      query.perPage,
    );

    const where: Record<string, unknown> = { deletedAt: null };

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.search) {
      where.OR = [
        { nameEn: { contains: query.search, mode: 'insensitive' } },
        { nameAr: { contains: query.search, mode: 'insensitive' } },
        { address: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.branch.findMany({
        where,
        orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
        skip,
        take: perPage,
      }),
      this.prisma.branch.count({ where }),
    ]);

    // Strip deletedAt from response
    const cleaned = items.map(({ deletedAt: _, ...item }) => item);

    return {
      items: cleaned,
      meta: buildPaginationMeta(total, page, perPage),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  FIND BY ID
  // ═══════════════════════════════════════════════════════════════

  async findById(id: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, deletedAt: null },
    });
    if (!branch) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Branch not found',
        error: 'NOT_FOUND',
      });
    }
    const { deletedAt: _, ...result } = branch;
    return result;
  }

  // ═══════════════════════════════════════════════════════════════
  //  CREATE
  // ═══════════════════════════════════════════════════════════════

  async create(dto: CreateBranchDto) {
    const branch = await this.prisma.branch.create({
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        address: dto.address,
        phone: dto.phone,
        email: dto.email,
        isMain: dto.isMain ?? false,
        isActive: dto.isActive ?? true,
        timezone: dto.timezone ?? 'Asia/Riyadh',
      },
    });
    const { deletedAt: _, ...result } = branch;
    return result;
  }

  // ═══════════════════════════════════════════════════════════════
  //  UPDATE
  // ═══════════════════════════════════════════════════════════════

  async update(id: string, dto: UpdateBranchDto) {
    await this.ensureExists(id);

    const updated = await this.prisma.branch.update({
      where: { id },
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        address: dto.address,
        phone: dto.phone,
        email: dto.email,
        isMain: dto.isMain,
        isActive: dto.isActive,
        timezone: dto.timezone,
      },
    });
    const { deletedAt: _, ...result } = updated;
    return result;
  }

  // ═══════════════════════════════════════════════════════════════
  //  SOFT DELETE
  // ═══════════════════════════════════════════════════════════════

  async delete(id: string) {
    await this.ensureExists(id);

    await this.prisma.branch.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { deleted: true };
  }

  // ═══════════════════════════════════════════════════════════════
  //  PRACTITIONERS ↔ BRANCH (M2M)
  // ═══════════════════════════════════════════════════════════════

  async getPractitioners(branchId: string) {
    await this.ensureExists(branchId);

    return this.prisma.practitionerBranch.findMany({
      where: { branchId },
      include: {
        practitioner: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async assignPractitioners(branchId: string, practitionerIds: string[]) {
    await this.ensureExists(branchId);

    // Validate all practitioner IDs exist and are not soft-deleted
    const existing = await this.prisma.practitioner.findMany({
      where: { id: { in: practitionerIds }, deletedAt: null },
      select: { id: true },
    });
    if (existing.length !== practitionerIds.length) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'One or more practitioners not found',
        error: 'PRACTITIONER_NOT_FOUND',
      });
    }

    const operations = practitionerIds.map((practitionerId) =>
      this.prisma.practitionerBranch.upsert({
        where: { practitionerId_branchId: { practitionerId, branchId } },
        create: { practitionerId, branchId },
        update: {},
      }),
    );

    await this.prisma.$transaction(operations);
    return this.getPractitioners(branchId);
  }

  async removePractitioner(branchId: string, practitionerId: string) {
    await this.ensureExists(branchId);

    const result = await this.prisma.practitionerBranch.deleteMany({
      where: { branchId, practitionerId },
    });

    if (result.count === 0) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Practitioner is not assigned to this branch',
        error: 'NOT_FOUND',
      });
    }

    return { removed: true };
  }

  // ═══════════════════════════════════════════════════════════════
  //  PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════

  private async ensureExists(id: string): Promise<void> {
    const branch = await this.prisma.branch.findFirst({
      where: { id, deletedAt: null },
    });
    if (!branch) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Branch not found',
        error: 'NOT_FOUND',
      });
    }
  }
}
