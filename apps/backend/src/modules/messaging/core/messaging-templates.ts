import type { NotificationType } from '@prisma/client';
import { MessagingEvent } from './messaging-events.js';
import { authPaymentTemplates } from './templates/auth-payment.templates.js';
import { bookingTemplates } from './templates/booking.templates.js';
import { groupSystemTemplates } from './templates/group-system.templates.js';

export interface RenderedMessage {
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  notificationType: NotificationType;
}

export interface EventTemplate<TCtx = Record<string, string>> {
  category: 'booking' | 'payment' | 'auth' | 'group' | 'system';
  defaultChannels: ('push' | 'email' | 'sms')[];
  overridePreferences?: boolean;
  render: (ctx: TCtx) => RenderedMessage;
}

export const TEMPLATES: Record<MessagingEvent, EventTemplate<Record<string, string>>> = {
  ...authPaymentTemplates,
  ...bookingTemplates,
  ...groupSystemTemplates,
} as Record<MessagingEvent, EventTemplate<Record<string, string>>>;
