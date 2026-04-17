import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

const SINGLETON_ID = 'default';

@Injectable()
export class GetBrandingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute() {
    return this.prisma.brandingConfig.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, organizationNameAr: 'منظمتي' },
      update: {},
    });
  }
}