/**
 * Plain-text email template builder.
 * Each template returns a bilingual (Arabic + English) body.
 */

const SEPARATOR = '\n---\n';

function otpLoginBody(context: Record<string, unknown>): string {
  const code = String(context['code'] ?? '');
  const firstName = context['firstName'] ? String(context['firstName']) : '';
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,';
  const greetingAr = firstName ? `${firstName} ,مرحبا` : ',مرحبا';

  return [
    greeting,
    '',
    `Your login verification code is: ${code}`,
    '',
    'This code expires in 10 minutes. If you did not request this, please ignore this email.',
    SEPARATOR,
    greetingAr,
    '',
    `${code} :رمز التحقق لتسجيل الدخول هو`,
    '',
    '.صالح لمدة 10 دقائق. إذا لم تطلب هذا الرمز، يرجى تجاهل هذا البريد',
    '',
    '— CareKit',
  ].join('\n');
}

function otpResetBody(context: Record<string, unknown>): string {
  const code = String(context['code'] ?? '');
  const firstName = context['firstName'] ? String(context['firstName']) : '';
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,';
  const greetingAr = firstName ? `${firstName} ,مرحبا` : ',مرحبا';

  return [
    greeting,
    '',
    `Your password reset code is: ${code}`,
    '',
    'This code expires in 10 minutes. If you did not request a password reset, please ignore this email.',
    SEPARATOR,
    greetingAr,
    '',
    `${code} :رمز إعادة تعيين كلمة المرور هو`,
    '',
    '.صالح لمدة 10 دقائق. إذا لم تطلب إعادة تعيين كلمة المرور، يرجى تجاهل هذا البريد',
    '',
    '— CareKit',
  ].join('\n');
}

function otpVerifyBody(context: Record<string, unknown>): string {
  const code = String(context['code'] ?? '');
  const firstName = context['firstName'] ? String(context['firstName']) : '';
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,';
  const greetingAr = firstName ? `${firstName} ,مرحبا` : ',مرحبا';

  return [
    greeting,
    '',
    `Your email verification code is: ${code}`,
    '',
    'This code expires in 10 minutes.',
    SEPARATOR,
    greetingAr,
    '',
    `${code} :رمز تأكيد البريد الإلكتروني هو`,
    '',
    '.صالح لمدة 10 دقائق',
    '',
    '— CareKit',
  ].join('\n');
}

function welcomeBody(context: Record<string, unknown>): string {
  const firstName = context['firstName'] ? String(context['firstName']) : '';
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,';
  const greetingAr = firstName ? `${firstName} ,مرحبا` : ',مرحبا';

  return [
    greeting,
    '',
    'Welcome to CareKit! Your account has been created successfully.',
    '',
    'You can now book appointments, consult with practitioners, and manage your health records.',
    SEPARATOR,
    greetingAr,
    '',
    '!أهلا بك في كيركت! تم إنشاء حسابك بنجاح',
    '',
    '.يمكنك الآن حجز المواعيد واستشارة الأطباء وإدارة سجلاتك الصحية',
    '',
    '— CareKit',
  ].join('\n');
}

function bookingConfirmationBody(context: Record<string, unknown>): string {
  const firstName = context['firstName'] ? String(context['firstName']) : '';
  const date = String(context['date'] ?? '');
  const time = String(context['time'] ?? '');
  const practitioner = String(context['practitioner'] ?? '');
  const service = String(context['service'] ?? '');

  const greeting = firstName ? `Hi ${firstName},` : 'Hi,';
  const greetingAr = firstName ? `${firstName} ,مرحبا` : ',مرحبا';

  return [
    greeting,
    '',
    'Your booking has been confirmed:',
    '',
    `  Service: ${service}`,
    `  Practitioner: ${practitioner}`,
    `  Date: ${date}`,
    `  Time: ${time}`,
    '',
    'If you need to reschedule or cancel, please contact us through the app.',
    SEPARATOR,
    greetingAr,
    '',
    ':تم تأكيد حجزك',
    '',
    `  ${service} :الخدمة`,
    `  ${practitioner} :الطبيب`,
    `  ${date} :التاريخ`,
    `  ${time} :الوقت`,
    '',
    '.إذا احتجت إلى إعادة الجدولة أو الإلغاء، يرجى التواصل عبر التطبيق',
    '',
    '— CareKit',
  ].join('\n');
}

const TEMPLATE_BUILDERS: Record<string, (ctx: Record<string, unknown>) => string> = {
  'otp-login': otpLoginBody,
  'otp-reset': otpResetBody,
  'otp-verify': otpVerifyBody,
  'welcome': welcomeBody,
  'booking-confirmation': bookingConfirmationBody,
};

export function buildPlainText(
  template: string,
  context: Record<string, unknown>,
): string {
  const builder = TEMPLATE_BUILDERS[template];
  if (!builder) {
    return `[CareKit] ${template}\n\n${JSON.stringify(context)}`;
  }
  return builder(context);
}
