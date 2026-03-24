import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto.js';
import { UserRolesService } from './user-roles.service.js';
import { ActivityLogService } from '../activity-log/activity-log.service.js';
import { SALT_ROUNDS } from '../../config/constants.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userRolesService: UserRolesService,
    private readonly activityLogService: ActivityLogService,
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
    const page = params?.page ?? 1;
    const perPage = Math.min(params?.perPage ?? 20, 100);
    const allowedSortFields = ['createdAt', 'updatedAt', 'firstName', 'lastName', 'email', 'isActive'];
    const sortBy = allowedSortFields.includes(params?.sortBy ?? '') ? params!.sortBy! : 'createdAt';
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
        include: {
          userRoles: {
            include: { role: true },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / perPage);

    return {
      items: users.map((u) => this.sanitizeUser(u)),
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
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });
    if (!user || user.deletedAt) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'User not found',
        error: 'USER_NOT_FOUND',
      });
    }
    return this.sanitizeUser(user);
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
      const isSuperAdmin = requesterRoles.some((ur) => ur.role.slug === 'super_admin');
      if (!isSuperAdmin) {
        throw new BadRequestException({
          statusCode: 403,
          message: 'Only super admins can assign the super_admin role',
          error: 'PRIVILEGE_ESCALATION',
        });
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        gender: dto.gender,
      },
    });

    // Assign role separately
    await this.prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id,
      },
    });

    // If role is practitioner, create a default practitioner record
    if (dto.roleSlug === 'practitioner') {
      const defaultSpecialty = await this.prisma.specialty.findFirst({
        where: { isActive: true },
      });
      if (defaultSpecialty) {
        await this.prisma.practitioner.create({
          data: {
            userId: user.id,
            specialtyId: defaultSpecialty.id,
          },
        });
      }
    }

    await this.activityLogService.log({
      userId: requesterId,
      action: 'user_created',
      module: 'users',
      resourceId: user.id,
      description: `User created with role ${dto.roleSlug}`,
    });

    return {
      ...this.sanitizeUser({
        ...user,
        userRoles: [{ role }],
      } as Parameters<typeof this.sanitizeUser>[0]),
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
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    return this.sanitizeUser(updated);
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

    await this.activityLogService.log({
      userId: requesterId,
      action: 'user_deleted',
      module: 'users',
      resourceId: id,
      description: 'User soft-deleted',
    });
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
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    return this.sanitizeUser(updated);
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
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    return this.sanitizeUser(updated);
  }

  async assignRole(userId: string, roleId?: string, roleSlug?: string) {
    let resolvedRoleId = roleId;

    if (!resolvedRoleId && roleSlug) {
      const role = await this.prisma.role.findUnique({
        where: { slug: roleSlug },
      });
      if (!role) {
        throw new NotFoundException({
          statusCode: 404,
          message: 'Role not found',
          error: 'ROLE_NOT_FOUND',
        });
      }
      resolvedRoleId = role.id;
    }

    if (!resolvedRoleId) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'roleId or roleSlug is required',
        error: 'VALIDATION_ERROR',
      });
    }

    return this.userRolesService.assignRole(userId, resolvedRoleId);
  }

  async removeRole(userId: string, roleId: string) {
    return this.userRolesService.removeRole(userId, roleId);
  }

  private sanitizeUser(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string | null;
    gender?: string | null;
    isActive: boolean;
    emailVerified?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
    userRoles?: Array<{
      role: {
        id?: string;
        name?: string;
        slug: string;
      };
    }>;
    passwordHash?: string | null;
    deletedAt?: Date | null;
    avatarUrl?: string | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? null,
      gender: user.gender ?? null,
      isActive: user.isActive,
      emailVerified: user.emailVerified ?? false,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles: (user.userRoles ?? []).map((ur) => ur.role.slug),
    };
  }
}
