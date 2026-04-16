import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

const SINGLETON_ID = 'default';

@Injectable()
export class GetZatcaConfigHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute() {
    return this.prisma.zatcaConfig.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID },
      update: {},
    });
  }
}