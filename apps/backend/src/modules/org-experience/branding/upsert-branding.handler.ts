import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { UpsertBrandingDto } from './upsert-branding.dto';

const SINGLETON_ID = 'default';

@Injectable()
export class UpsertBrandingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: UpsertBrandingDto) {
    return this.prisma.brandingConfig.upsert({
      where: { id: SINGLETON_ID },
      create: { ...dto, id: SINGLETON_ID },
      update: dto,
    });
  }
}