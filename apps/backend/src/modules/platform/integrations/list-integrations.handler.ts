import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

@Injectable()
export class ListIntegrationsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(tenantId: string) {
    return this.prisma.integration.findMany({
      where: { tenantId, isActive: true },
      orderBy: { provider: 'asc' },
    });
  }
}
