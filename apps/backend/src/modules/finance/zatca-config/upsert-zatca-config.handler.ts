import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { UpsertZatcaConfigDto } from './upsert-zatca-config.dto';

const SINGLETON_ID = 'default';

@Injectable()
export class UpsertZatcaConfigHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: UpsertZatcaConfigDto) {
    return this.prisma.zatcaConfig.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...dto },
      update: dto,
    });
  }
}