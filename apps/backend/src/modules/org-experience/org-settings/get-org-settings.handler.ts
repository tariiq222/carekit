import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

const SINGLETON_ID = 'default';

@Injectable()
export class GetOrgSettingsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute() {
    return this.prisma.organizationSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID },
      update: {},
    });
  }
}