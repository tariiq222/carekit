import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { UpsertOrgSettingsDto } from './upsert-org-settings.dto';

const SINGLETON_ID = 'default';

@Injectable()
export class UpsertOrgSettingsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: UpsertOrgSettingsDto) {
    return this.prisma.organizationSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...dto },
      update: dto,
    });
  }
}