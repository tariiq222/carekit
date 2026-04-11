import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

export interface IFcmService {
  sendPush(token: string, title: string, body: string, data?: Record<string, string>): Promise<string>;
  sendMulticast(tokens: string[], title: string, body: string, data?: Record<string, string>): Promise<{ successCount: number; failureCount: number }>;
  isAvailable(): boolean;
}

@Injectable()
export class FcmService implements IFcmService, OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private initialized = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const projectId = this.config.get<string>('FCM_PROJECT_ID');
    if (!projectId) {
      this.logger.warn('FCM_PROJECT_ID not set — push notifications disabled');
      return;
    }

    const clientEmail = this.config.get<string>('FCM_CLIENT_EMAIL');
    const privateKey = this.config.get<string>('FCM_PRIVATE_KEY')?.replace(/\\n/g, '\n');

    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });

    this.initialized = true;
    this.logger.log('Firebase Admin initialized');
  }

  isAvailable(): boolean {
    return this.initialized;
  }

  async sendPush(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<string> {
    if (!this.initialized) {
      throw new Error('FCM is not initialized');
    }

    const messageId = await admin.messaging().send({
      token,
      notification: { title, body },
      data,
    });

    return messageId;
  }

  async sendMulticast(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<{ successCount: number; failureCount: number }> {
    if (!this.initialized) {
      throw new Error('FCM is not initialized');
    }

    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data,
    });

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  }
}
