import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface GetZatcaConfigQuery { tenantId: string; }

@Injectable()
export class GetZatcaConfigHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetZatcaConfigQuery) {
    return this.prisma.zatcaConfig.upsert({
      where: { tenantId: query.tenantId },
      update: {},
      create: { tenantId: query.tenantId },
    });
  }
}
