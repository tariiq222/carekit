import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';

@Injectable()
export class ListPlansAdminHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute() {
    return this.prisma.$allTenants.plan.findMany({
      orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }],
      include: { _count: { select: { subscriptions: true } } },
    });
  }
}
