import { TEMPLATES } from '../../../src/modules/messaging/core/messaging-templates.js';
import { MessagingEvent } from '../../../src/modules/messaging/core/messaging-events.js';

describe('TEMPLATES registry', () => {
  it('covers every MessagingEvent value', () => {
    const allEvents = Object.values(MessagingEvent);
    for (const event of allEvents) {
      expect(TEMPLATES[event]).toBeDefined();
    }
  });

  it('BOOKING_CONFIRMED renders Arabic title', () => {
    const tpl = TEMPLATES[MessagingEvent.BOOKING_CONFIRMED];
    const result = tpl.render({ date: '2026-05-01', time: '10:00', practitionerName: 'أحمد', serviceName: 'استشارة' });
    expect(result.titleAr).toBe('تأكيد الموعد');
    expect(result.bodyAr).toContain('أحمد');
  });

  it('OTP_REQUESTED has override: true (bypasses preferences)', () => {
    expect(TEMPLATES[MessagingEvent.OTP_REQUESTED].overridePreferences).toBe(true);
  });

  it('every template render returns all 4 string fields', () => {
    const minCtx = {
      date: 'd', time: 't', practitionerName: 'p', serviceName: 's',
      code: '1234', firstName: 'علي', otpCode: '5678',
      bookingId: 'b1', amount: '100',
    };
    for (const [event, tpl] of Object.entries(TEMPLATES)) {
      const r = (tpl as typeof TEMPLATES[MessagingEvent]).render(minCtx as never);
      expect(typeof r.titleAr).toBe('string');
      expect(typeof r.titleEn).toBe('string');
      expect(typeof r.bodyAr).toBe('string');
      expect(typeof r.bodyEn).toBe('string');
      expect(typeof r.notificationType).toBe('string');
    }
  });
});
