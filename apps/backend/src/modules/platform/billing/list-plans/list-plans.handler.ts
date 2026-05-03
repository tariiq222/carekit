import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

@Injectable()
export class ListPlansHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute() {
    return this.prisma.plan.findMany({
      where: { isActive: true, isVisible: true },
      orderBy: { sortOrder: 'asc' },
    });
  }
}
