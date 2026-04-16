import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

@Injectable()
export class GetFeatureFlagMapHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<Record<string, boolean>> {
    const flags = await this.prisma.featureFlag.findMany();
    return Object.fromEntries(flags.map((f) => [f.key, f.enabled]));
  }
}
