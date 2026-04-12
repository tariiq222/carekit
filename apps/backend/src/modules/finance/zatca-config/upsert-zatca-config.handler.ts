import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { UpsertZatcaConfigDto } from './upsert-zatca-config.dto';

export type UpsertZatcaConfigCommand = UpsertZatcaConfigDto & { tenantId: string };

@Injectable()
export class UpsertZatcaConfigHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UpsertZatcaConfigCommand) {
    const { tenantId, ...fields } = cmd;
    return this.prisma.zatcaConfig.upsert({
      where: { tenantId },
      update: fields,
      create: { tenantId, ...fields },
    });
  }
}
