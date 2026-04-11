import { MessagingEvent } from '../messaging-events.js';
import type { EventTemplate } from '../messaging-templates.js';

export const groupSystemTemplates: Partial<Record<MessagingEvent, EventTemplate<Record<string, string>>>> = {
  [MessagingEvent.GROUP_SESSION_REMINDER]: {
    category: 'group',
    defaultChannels: ['push', 'sms'],
    render: (ctx) => ({
      titleAr: 'تذكير بالجلسة الجماعية',
      titleEn: 'Group Session Reminder',
      bodyAr: `جلستك الجماعية مع ${ctx['practitionerName']} غداً الساعة ${ctx['time']}`,
      bodyEn: `Your group session with ${ctx['practitionerName']} is tomorrow at ${ctx['time']}`,
      notificationType: 'booking_reminder',
    }),
  },

  [MessagingEvent.GROUP_ENROLLMENT_CONFIRMED]: {
    category: 'group',
    defaultChannels: ['push'],
    render: (ctx) => ({
      titleAr: 'تأكيد التسجيل',
      titleEn: 'Enrollment Confirmed',
      bodyAr: `تم تأكيد تسجيلك في جلسة ${ctx['serviceName']}`,
      bodyEn: `Your enrollment in ${ctx['serviceName']} has been confirmed`,
      notificationType: 'group_enrollment_created',
    }),
  },

  [MessagingEvent.GROUP_CAPACITY_REACHED]: {
    category: 'group',
    defaultChannels: ['push'],
    render: (ctx) => ({
      titleAr: 'اكتمل عدد المشتركين',
      titleEn: 'Group Capacity Reached',
      bodyAr: `اكتملت الجلسة الجماعية ${ctx['serviceName']}`,
      bodyEn: `Group session ${ctx['serviceName']} has reached full capacity`,
      notificationType: 'group_capacity_reached',
    }),
  },

  [MessagingEvent.GROUP_SESSION_CONFIRMED]: {
    category: 'group',
    defaultChannels: ['push'],
    render: (ctx) => ({
      titleAr: 'تأكيد الجلسة الجماعية',
      titleEn: 'Group Session Confirmed',
      bodyAr: `تم تأكيد الجلسة الجماعية ${ctx['serviceName']} بتاريخ ${ctx['date']}`,
      bodyEn: `Group session ${ctx['serviceName']} on ${ctx['date']} is confirmed`,
      notificationType: 'group_session_confirmed',
    }),
  },

  [MessagingEvent.GROUP_PAYMENT_CONFIRMED]: {
    category: 'group',
    defaultChannels: ['push'],
    render: (ctx) => ({
      titleAr: 'تأكيد الدفع',
      titleEn: 'Payment Confirmed',
      bodyAr: `تم تأكيد دفعتك بمبلغ ${ctx['amount']} ريال للجلسة الجماعية`,
      bodyEn: `Your payment of ${ctx['amount']} SAR for the group session is confirmed`,
      notificationType: 'group_payment_confirmed',
    }),
  },

  [MessagingEvent.GROUP_ATTENDANCE_MARKED]: {
    category: 'group',
    defaultChannels: ['push'],
    render: (_ctx) => ({
      titleAr: 'تم تسجيل حضورك',
      titleEn: 'Attendance Marked',
      bodyAr: 'تم تسجيل حضورك في الجلسة',
      bodyEn: 'Your attendance has been recorded',
      notificationType: 'system_alert',
    }),
  },

  [MessagingEvent.PROBLEM_REPORT_RESOLVED]: {
    category: 'system',
    defaultChannels: ['push'],
    render: (_ctx) => ({
      titleAr: 'تم حل المشكلة',
      titleEn: 'Problem Resolved',
      bodyAr: 'تم مراجعة بلاغك وحل المشكلة المُبلَّغ عنها',
      bodyEn: 'Your problem report has been reviewed and resolved',
      notificationType: 'system_alert',
    }),
  },
};
