import type { Locale } from './locale';

export const dictionary = {
  ar: {
    'nav.home': 'الرئيسية',
    'nav.therapists': 'المعالجون',
    'nav.contact': 'تواصل معنا',
    'nav.burnout': 'اختبار الإرهاق',
    'contact.title': 'تواصل معنا',
    'contact.description': 'لأي استفسار، املأ النموذج أدناه وسنعود إليك قريباً.',
    'therapists.title': 'معالجونا',
    'therapists.empty': 'لم يتم نشر أي معالجين بعد.',
    'burnout.title': 'اختبار الإرهاق النفسي',
    'burnout.description': 'أجب عن الأسئلة التالية لمعرفة مستوى الإرهاق.',
    'burnout.submit': 'عرض النتيجة',
    'burnout.result.low': 'مستوى منخفض — حالتك جيدة.',
    'burnout.result.medium': 'مستوى متوسط — نوصي بأخذ قسط من الراحة.',
    'burnout.result.high': 'مستوى مرتفع — ننصح بحجز استشارة.',
  },
  en: {
    'nav.home': 'Home',
    'nav.therapists': 'Therapists',
    'nav.contact': 'Contact',
    'nav.burnout': 'Burnout Test',
    'contact.title': 'Contact Us',
    'contact.description': 'For any inquiry, fill the form below and we will get back to you.',
    'therapists.title': 'Our Therapists',
    'therapists.empty': 'No therapists published yet.',
    'burnout.title': 'Burnout Self-Assessment',
    'burnout.description': 'Answer the questions below to see your level.',
    'burnout.submit': 'See result',
    'burnout.result.low': 'Low level — you are doing well.',
    'burnout.result.medium': 'Medium level — consider taking a break.',
    'burnout.result.high': 'High level — we recommend booking a consultation.',
  },
} satisfies Record<Locale, Record<string, string>>;

export type MessageKey = keyof (typeof dictionary)['ar'];

export function t(locale: Locale, key: MessageKey): string {
  return dictionary[locale][key];
}
