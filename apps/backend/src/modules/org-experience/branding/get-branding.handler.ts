import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export type GetBrandingCommand = { tenantId: string };

@Injectable()
export class GetBrandingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: GetBrandingCommand) {
    const config = await this.prisma.brandingConfig.findUnique({
      where: { tenantId: dto.tenantId },
    });
    if (!config) throw new NotFoundException('Branding config not found');
    return config;
  }
}
