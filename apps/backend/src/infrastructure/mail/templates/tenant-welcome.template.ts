import { bilingualLayout, escapeHtml, BRAND } from './shared';

export interface TenantWelcomeVars {
  ownerName: string;
  orgName: string;
  dashboardUrl: string;
}

export function tenantWelcomeTemplate(vars: TenantWelcomeVars): {
  subjectAr: string;
  subjectEn: string;
  html: string;
} {
  const name = escapeHtml(vars.ownerName);
  const org = escapeHtml(vars.orgName);
  const url = escapeHtml(vars.dashboardUrl);

  const ar = `
    <h1 style="color:${BRAND.primary};font-size:22px;margin:0 0 16px;">أهلاً ${name} 👋</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      شكرًا لانضمامك إلى CareKit. حسابك "${org}" جاهز، ومدّة التجربة المجانية ١٤ يومًا.
    </p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;">افتح لوحة التحكم</a>
    </p>
  `;

  const en = `
    <h1 style="color:${BRAND.primary};font-size:22px;margin:0 0 16px;">Welcome, ${name} 👋</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      Thanks for joining CareKit. Your "${org}" workspace is ready and your 14-day free trial has started.
    </p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;">Open Dashboard</a>
    </p>
  `;

  return {
    subjectAr: 'مرحبًا بك في CareKit',
    subjectEn: 'Welcome to CareKit',
    html: bilingualLayout({ ar, en }),
  };
}
