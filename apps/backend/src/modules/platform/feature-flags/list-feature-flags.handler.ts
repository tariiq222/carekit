import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

@Injectable()
export class ListFeatureFlagsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute() {
    return this.prisma.featureFlag.findMany({
      orderBy: { key: 'asc' },
    });
  }
}
