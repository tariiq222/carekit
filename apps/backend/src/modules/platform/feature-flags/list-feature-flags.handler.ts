import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

@Injectable()
export class ListFeatureFlagsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(tenantId: string) {
    return this.prisma.featureFlag.findMany({
      where: { tenantId },
      orderBy: { key: 'asc' },
    });
  }
}