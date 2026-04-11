import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto.js';
import { ActivityLogService } from '../activity-log/activity-log.service.js';
import { PractitionersService } from '../practitioners/practitioners.service.js';
import { AuthCacheService } from '../auth/auth-cache.service.js';
import {
  sanitizeUser,
  SanitizableUser,
  userRolesInclude,
} from './users.helpers.js';
import { SALT_ROUNDS, ROLE_PRACTITIONER } from '../../config/constants.js';
import {
  parsePaginationParams,
  buildPaginationMeta,
} from '../../common/helpers/pagination.helper.js';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogService: ActivityLogService,
    private readonly practitionersService: PractitionersService,
    private readonly authCache: AuthCacheService,
  ) {}

  async findAll(params?: {
    page?: number;
    perPage?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    search?: string;
    role?: string;
    isActive?: boolean;
  }) {
    const { page, perPage, skip } = parsePaginationParams(
      params?.page,
      params?.perPage,
      100,
    );
    const allowedSortFields = [
      'createdAt',
      'updatedAt',
      'firstName',
      'lastName',
      'email',
      'isActive',
    ];
    const sortBy = allowedSortFields.includes(params?.sortBy ?? '')
      ? params!.sortBy!
      : 'createdAt';
    const sortOrder = params?.sortOrder ?? 'desc';

    const where: Record<string, unknown> = { deletedAt: null };

    if (params?.isActive !== undefined) {
      where.isActive = params.isActive;
    }

    if (params?.search) {
      where.OR = [
        { firstName: { contains: params.search, mode: 'insensitive' } },
        { lastName: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    if (params?.role) {
      where.userRoles = {
        some: { role: { slug: params.role } },
      };
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: userRolesInclude,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: perPage,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: users.map((u) => sanitizeUser(u)),
      meta: buildPaginationMeta(total, page, perPage),
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: userRolesInclude,
    });
    if (!user || user.deletedAt) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'User not found',
        error: 'USER_NOT_FOUND',
      });
    }
    return sanitizeUser(user);
  }

  async create(dto: CreateUserDto, requesterId?: string) {
    const normalizedEmail = dto.email.toLowerCase();

    // Check duplicate email
    const existing = await this.prisma.user.findFirst({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        message: 'A user with this email already exists',
        error: 'USER_EMAIL_EXISTS',
      });
    }

    // Find role
    const role = await this.prisma.role.findFirst({
      where: { slug: dto.roleSlug },
    });
    if (!role) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Role not found',
        error: 'ROLE_NOT_FOUND',
      });
    }

    // Prevent privilege escalation: only super_admin can assign super_admin
    if (role.slug === 'super_admin' && requesterId) {
      const requesterRoles = await this.prisma.userRole.findMany({
        where: { userId: requesterId },
        include: { role: true },
      });
      const isSuperAdmin = requesterRoles.some(
        (ur) => ur.role.slug === 'super_admin',
      );
      if (!isSuperAdmin) {
        throw new ForbiddenException({
          statusCode: 403,
          message: 'Only super admins can assign the super_admin role',
          error: 'PRIVILEGE_ESCALATION',
        });
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          gender: dto.gender,
        },
      });

      await tx.userRole.create({
        data: { userId: created.id, roleId: role.id },
      });

      return created;
    });

    // Create practitioner profile if role is practitioner (delegated to PractitionersService)
    if (dto.roleSlug === ROLE_PRACTITIONER) {
      await this.practitionersService.createForUser(user.id);
    }

    this.activityLogService
      .log({
        userId: requesterId,
        action: 'user_created',
        module: 'users',
        resourceId: user.id,
        description: `User created with role ${dto.roleSlug}`,
      })
      .catch((err) =>
        this.logger.warn('Activity log failed', { error: err?.message }),
      );

    return {
      ...sanitizeUser({
        ...user,
        userRoles: [{ role }],
      } as SanitizableUser),
    };
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.deletedAt) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'User not found',
        error: 'USER_NOT_FOUND',
      });
    }

    // Check email uniqueness if changing email
    if (dto.email && dto.email !== user.email) {
      const emailTaken = await this.prisma.user.findFirst({
        where: { email: dto.email.toLowerCase(), id: { not: id } },
      });
      if (emailTaken) {
        throw new ConflictException({
          statusCode: 409,
          message: 'A user with this email already exists',
          error: 'USER_EMAIL_EXISTS',
        });
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        email: dto.email ? dto.email.toLowerCase() : undefined,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        gender: dto.gender,
      },
      include: userRolesInclude,
    });

    return sanitizeUser(updated);
  }

  async softDelete(id: string, requesterId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'User not found',
        error: 'USER_NOT_FOUND',
      });
    }

    if (id === requesterId) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Cannot delete your own account',
        error: 'VALIDATION_ERROR',
      });
    }

    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    // Invalidate cache so deleted user cannot use existing access tokens
    await this.authCache.invalidate(id);

    this.activityLogService
      .log({
        userId: requesterId,
        action: 'user_deleted',
        module: 'users',
        resourceId: id,
        description: 'User soft-deleted',
      })
      .catch((err) =>
        this.logger.warn('Activity log failed', { error: err?.message }),
      );
  }

  async activate(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.deletedAt) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'User not found',
        error: 'USER_NOT_FOUND',
      });
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: true },
      include: userRolesInclude,
    });

    // Invalidate cache so isActive=true takes effect immediately
    await this.authCache.invalidate(id);

    return sanitizeUser(updated);
  }

  async deactivate(id: string, requesterId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.deletedAt) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'User not found',
        error: 'USER_NOT_FOUND',
      });
    }

    if (id === requesterId) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Cannot deactivate your own account',
        error: 'VALIDATION_ERROR',
      });
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      include: userRolesInclude,
    });

    // Invalidate cache so deactivated user is rejected on next request
    await this.authCache.invalidate(id);

    return sanitizeUser(updated);
  }
}
