import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ListProblemReportsDto } from './list-problem-reports.dto';

export type ListProblemReportsQuery = ListProblemReportsDto & { tenantId: string };

@Injectable()
export class ListProblemReportsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListProblemReportsQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = { tenantId: query.tenantId, status: query.status };
    const [data, total] = await Promise.all([
      this.prisma.problemReport.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.problemReport.count({ where }),
    ]);
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
