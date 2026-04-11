export type RecipientType = 'CLIENT' | 'EMPLOYEE';
export type NotificationType =
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_REMINDER'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_FAILED'
  | 'WELCOME'
  | 'GENERAL';

export interface SendNotificationDto {
  tenantId: string;
  recipientId: string;
  recipientType: RecipientType;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  channels: Array<'push' | 'email' | 'sms' | 'in-app'>;
  fcmToken?: string;
  recipientEmail?: string;
  emailTemplateSlug?: string;
  emailVars?: Record<string, string>;
  recipientPhone?: string;
}
