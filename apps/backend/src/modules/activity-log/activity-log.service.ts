import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { buildPaginationMeta } from '../../common/helpers/pagination.helper.js';
import type { Prisma } from '@prisma/client';

const SENSITIVE_FIELDS = new Set([
  'password',
  'passwordHash',
  'hashedPassword',
  'refreshToken',
  'accessToken',
  'token',
  'secret',
  'apiKey',
  'privateKey',
  'cvv',
  'cardNumber',
]);

function redactSensitive(
  obj: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!obj) return undefined;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = SENSITIVE_FIELDS.has(key) ? '[REDACTED]' : value;
  }
  return result;
}

export interface LogActivityParams {
  userId?: string;
  action: string;
  module: string;
  resourceId?: string;
  description?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

interface FindAllParams {
  page?: number;
  perPage?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  module?: string;
  action?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(params: LogActivityParams): Promise<void> {
    try {
      await this.prisma.activityLog.create({
        data: {
          userId: params.userId,
          action: params.action,
          module: params.module,
          resourceId: params.resourceId,
          description: params.description,
          oldValues: params.oldValues
            ? JSON.parse(JSON.stringify(redactSensitive(params.oldValues)))
            : undefined,
          newValues: params.newValues
            ? JSON.parse(JSON.stringify(redactSensitive(params.newValues)))
            : undefined,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
      });
    } catch (err) {
      this.logger.error('Failed to write activity log', err);
    }
  }

  async findAll(params: FindAllParams) {
    const page = params.page ?? 1;
    const perPage = params.perPage ?? 20;
    const sortBy = params.sortBy ?? 'createdAt';
    const sortOrder = params.sortOrder ?? 'desc';

    const where: Prisma.ActivityLogWhereInput = {};

    if (params.module) where.module = params.module;
    if (params.action) where.action = params.action;
    if (params.userId) where.userId = params.userId;

    if (params.dateFrom || params.dateTo) {
      where.createdAt = {};
      if (params.dateFrom) where.createdAt.gte = new Date(params.dateFrom);
      if (params.dateTo) where.createdAt.lte = new Date(params.dateTo);
    }

    const [items, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * perPage,
        take: perPage,
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
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return {
      success: true,
      data: {
        items,
        meta: buildPaginationMeta(total, page, perPage),
      },
    };
  }

  async findOne(id: string) {
    const log = await this.prisma.activityLog.findUnique({
      where: { id },
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
    });

    if (!log)
      throw new NotFoundException({
        statusCode: 404,
        message: 'Activity log not found',
        error: 'NOT_FOUND',
      });

    return { success: true, data: log };
  }
}
