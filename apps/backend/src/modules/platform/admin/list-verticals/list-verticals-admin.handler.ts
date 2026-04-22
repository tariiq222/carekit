import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';

@Injectable()
export class ListVerticalsAdminHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute() {
    return this.prisma.$allTenants.vertical.findMany({
      orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }],
    });
  }
}
