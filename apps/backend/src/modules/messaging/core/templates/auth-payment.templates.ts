import { MessagingEvent } from '../messaging-events.js';
import type { EventTemplate } from '../messaging-templates.js';

export const authPaymentTemplates: Partial<Record<MessagingEvent, EventTemplate<Record<string, string>>>> = {
  [MessagingEvent.OTP_REQUESTED]: {
    category: 'auth',
    defaultChannels: ['email', 'sms'],
    overridePreferences: true,
    render: (ctx) => ({
      titleAr: 'رمز التحقق',
      titleEn: 'Verification Code',
      bodyAr: `رمز التحقق الخاص بك هو: ${ctx['code']}`,
      bodyEn: `Your verification code is: ${ctx['code']}`,
      notificationType: 'system_alert',
    }),
  },

  [MessagingEvent.WELCOME]: {
    category: 'auth',
    defaultChannels: ['push', 'email'],
    render: (ctx) => ({
      titleAr: 'أهلاً بك',
      titleEn: 'Welcome',
      bodyAr: `مرحباً ${ctx['firstName']}، يسعدنا انضمامك`,
      bodyEn: `Welcome ${ctx['firstName']}, we're glad to have you`,
      notificationType: 'system_alert',
    }),
  },

  [MessagingEvent.PRACTITIONER_WELCOME]: {
    category: 'auth',
    defaultChannels: ['email'],
    render: (ctx) => ({
      titleAr: 'مرحباً بك',
      titleEn: 'Welcome',
      bodyAr: `مرحباً ${ctx['firstName']}، رمز كلمة المرور المؤقت: ${ctx['otpCode']}`,
      bodyEn: `Welcome ${ctx['firstName']}, your temporary password code: ${ctx['otpCode']}`,
      notificationType: 'system_alert',
    }),
  },

  [MessagingEvent.PAYMENT_RECEIVED]: {
    category: 'payment',
    defaultChannels: ['push'],
    render: (ctx) => ({
      titleAr: 'تم استلام الدفعة',
      titleEn: 'Payment Received',
      bodyAr: `تم استلام دفعتك بمبلغ ${ctx['amount']} ريال`,
      bodyEn: `Your payment of ${ctx['amount']} SAR has been received`,
      notificationType: 'payment_received',
    }),
  },

  [MessagingEvent.BANK_TRANSFER_SUBMITTED]: {
    category: 'payment',
    defaultChannels: ['push'],
    render: (ctx) => ({
      titleAr: 'تم استلام إيصال التحويل',
      titleEn: 'Transfer Receipt Submitted',
      bodyAr: `تم استلام إيصال التحويل البنكي بمبلغ ${ctx['amount']} ريال وهو قيد المراجعة`,
      bodyEn: `Bank transfer receipt of ${ctx['amount']} SAR received and under review`,
      notificationType: 'payment_received',
    }),
  },

  [MessagingEvent.RECEIPT_REJECTED]: {
    category: 'payment',
    defaultChannels: ['push', 'sms'],
    render: (_ctx) => ({
      titleAr: 'تم رفض إيصال التحويل البنكي',
      titleEn: 'Bank Transfer Receipt Rejected',
      bodyAr: 'تم رفض إيصال التحويل البنكي. يرجى إعادة الرفع أو التواصل معنا',
      bodyEn: 'Your bank transfer receipt was rejected. Please re-upload or contact us',
      notificationType: 'receipt_rejected',
    }),
  },
};
