import { OtpChannel } from '@prisma/client';

export interface NotificationChannel {
  readonly kind: OtpChannel;
  send(identifier: string, message: string): Promise<void>;
}
