import { bilingualLayout, escapeHtml, BRAND } from './shared';

export interface SubscriptionPaymentSucceededVars {
  ownerName: string;
  orgName: string;
  amountSar: string;
  invoiceId: string;
  receiptUrl: string;
}

export function subscriptionPaymentSucceededTemplate(
  vars: SubscriptionPaymentSucceededVars,
): { subjectAr: string; subjectEn: string; html: string } {
  const name = escapeHtml(vars.ownerName);
  const org = escapeHtml(vars.orgName);
  const amount = escapeHtml(vars.amountSar);
  const invoice = escapeHtml(vars.invoiceId);
  const url = escapeHtml(vars.receiptUrl);

  const ar = `
    <h1 style="color:${BRAND.primary};font-size:20px;margin:0 0 12px;">${name}، تم استلام الدفع ✅</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      تم خصم <strong>${amount} SAR</strong> لاشتراك "${org}". رقم الفاتورة <code>${invoice}</code>.
    </p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;">عرض الإيصال</a>
    </p>
  `;
  const en = `
    <h1 style="color:${BRAND.primary};font-size:20px;margin:0 0 12px;">${name}, payment received ✅</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      <strong>${amount} SAR</strong> was charged for your "${org}" subscription. Invoice <code>${invoice}</code>.
    </p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;">View receipt</a>
    </p>
  `;

  return {
    subjectAr: 'تم استلام دفع اشتراك Deqah',
    subjectEn: 'Deqah subscription payment received',
    html: bilingualLayout({ ar, en }),
  };
}
