import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { PrismaService } from '../../database/prisma.service.js';

interface PushNotificationPayload {
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  data?: Record<string, string>;
}

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private initialized = false;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn(
        'Firebase credentials not configured — push notifications disabled',
      );
      return;
    }

    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
      this.initialized = true;
      this.logger.log('Firebase Admin initialized');
    } catch (err) {
      this.logger.warn('Firebase Admin init failed — push disabled', err);
    }
  }

  async sendToUser(
    userId: string,
    notification: PushNotificationPayload,
  ): Promise<void> {
    if (!this.initialized) return;

    const tokens = await this.prisma.fcmToken.findMany({
      where: { userId },
      select: { token: true },
    });

    if (tokens.length === 0) return;

    const tokenStrings = tokens.map((t) => t.token);

    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: tokenStrings,
        notification: {
          title: notification.titleEn,
          body: notification.bodyEn,
        },
        data: {
          titleAr: notification.titleAr,
          titleEn: notification.titleEn,
          bodyAr: notification.bodyAr,
          bodyEn: notification.bodyEn,
          ...(notification.data ?? {}),
        },
      });

      await this.cleanupInvalidTokens(response, tokenStrings);
    } catch (err) {
      this.logger.error(`FCM send failed for user ${userId}`, err);
    }
  }

  private async cleanupInvalidTokens(
    response: admin.messaging.BatchResponse,
    tokenStrings: string[],
  ): Promise<void> {
    const failedTokens: string[] = [];

    response.responses.forEach((resp, idx) => {
      if (
        !resp.success &&
        resp.error?.code === 'messaging/registration-token-not-registered'
      ) {
        failedTokens.push(tokenStrings[idx]);
      }
    });

    if (failedTokens.length === 0) return;

    await this.prisma.fcmToken.deleteMany({
      where: { token: { in: failedTokens } },
    });

    this.logger.log(`Cleaned up ${failedTokens.length} invalid FCM tokens`);
  }
}
