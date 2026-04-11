import { Injectable } from '@nestjs/common';
import type { DevicePlatform } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service.js';

@Injectable()
export class FcmTokensService {
  constructor(private readonly prisma: PrismaService) {}

  async register(userId: string, token: string, platform: DevicePlatform): Promise<void> {
    await this.prisma.fcmToken.upsert({
      where: { userId_token: { userId, token } },
      create: { userId, token, platform },
      update: { platform },
    });
  }

  async unregister(userId: string, token: string): Promise<void> {
    await this.prisma.fcmToken.deleteMany({ where: { userId, token } });
  }
}
