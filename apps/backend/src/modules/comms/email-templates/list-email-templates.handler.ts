import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ListEmailTemplatesDto } from './list-email-templates.dto';

export type ListEmailTemplatesCommand = Omit<ListEmailTemplatesDto, 'page' | 'limit'> & {
  tenantId: string;
  page: number;
  limit: number;
};

@Injectable()
export class ListEmailTemplatesHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: ListEmailTemplatesCommand) {
    const where = { tenantId: cmd.tenantId };
    const [data, total] = await Promise.all([
      this.prisma.emailTemplate.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (cmd.page - 1) * cmd.limit,
        take: cmd.limit,
      }),
      this.prisma.emailTemplate.count({ where }),
    ]);
    return {
      data,
      meta: {
        total,
        page: cmd.page,
        limit: cmd.limit,
        totalPages: Math.ceil(total / cmd.limit),
      },
    };
  }
}
