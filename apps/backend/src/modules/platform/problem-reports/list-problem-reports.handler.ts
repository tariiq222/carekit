import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ProblemReportStatus } from '@prisma/client';

export interface ListProblemReportsQuery {
  tenantId: string;
  page: number;
  limit: number;
  status?: ProblemReportStatus;
}

@Injectable()
export class ListProblemReportsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListProblemReportsQuery) {
    const where = { tenantId: query.tenantId, status: query.status };
    const [data, total] = await Promise.all([
      this.prisma.problemReport.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.problemReport.count({ where }),
    ]);
    return {
      data,
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
  }
}
