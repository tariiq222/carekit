import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export type RecipientType = 'CLIENT' | 'EMPLOYEE';
export type NotificationType =
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_REMINDER'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_FAILED'
  | 'WELCOME'
  | 'GENERAL';

const RECIPIENT_TYPES: RecipientType[] = ['CLIENT', 'EMPLOYEE'];
const NOTIFICATION_TYPES: NotificationType[] = [
  'BOOKING_CONFIRMED',
  'BOOKING_CANCELLED',
  'BOOKING_REMINDER',
  'PAYMENT_RECEIVED',
  'PAYMENT_FAILED',
  'WELCOME',
  'GENERAL',
];

export class SendNotificationDto {
  @IsUUID() recipientId!: string;
  @IsIn(RECIPIENT_TYPES) recipientType!: RecipientType;
  @IsIn(NOTIFICATION_TYPES) type!: NotificationType;
  @IsString() @MinLength(1) title!: string;
  @IsString() @MinLength(1) body!: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
  @IsArray() @ArrayNotEmpty() @IsIn(['push', 'email', 'sms', 'in-app'], { each: true })
  channels!: Array<'push' | 'email' | 'sms' | 'in-app'>;
  @IsOptional() @IsString() fcmToken?: string;
  @IsOptional() @IsEmail() recipientEmail?: string;
  @IsOptional() @IsString() emailTemplateSlug?: string;
  @IsOptional() @IsObject() emailVars?: Record<string, string>;
  @IsOptional() @IsString() recipientPhone?: string;
}
