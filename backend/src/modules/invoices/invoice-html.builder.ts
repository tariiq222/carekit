/**
 * Builds the HTML template for invoice rendering.
 * Extracted from InvoiceCreatorService to respect file size limits.
 */

interface InvoiceHtmlParams {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  invoice: Record<string, any>;
  clinicName: string;
  clinicPhone: string;
  qrCodeData?: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  clinic_visit: 'زيارة عيادة',
  phone_consultation: 'استشارة هاتفية',
  video_consultation: 'استشارة مرئية',
};

const METHOD_LABELS: Record<string, string> = {
  moyasar: 'دفع إلكتروني (Moyasar)',
  bank_transfer: 'تحويل بنكي',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'في الانتظار',
  paid: 'مدفوع',
  refunded: 'مسترد',
  failed: 'فشل',
};

function formatHalalat(h: number): string {
  return (h / 100).toLocaleString('ar-SA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function buildInvoiceHtml(params: InvoiceHtmlParams): string {
  const { invoice, clinicName, clinicPhone, qrCodeData } = params;
  const { payment } = invoice;
  const { booking } = payment;

  const patientName = booking.patient
    ? `${booking.patient.firstName} ${booking.patient.lastName}`
    : 'N/A';
  const practitionerName = `${booking.practitioner.user.firstName} ${booking.practitioner.user.lastName}`;

  const baseAmount = payment.amount;
  const vatAmount = invoice.vatAmount || payment.vatAmount;
  const vatRate = invoice.vatRate || 0;
  const totalAmount = payment.totalAmount || baseAmount + vatAmount;

  const vatLabel = vatRate > 0
    ? `ضريبة القيمة المضافة (${vatRate}%)`
    : 'ضريبة القيمة المضافة';

  const fmt = formatHalalat;
  const fmtDate = formatDate;

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <title>فاتورة رقم ${invoice.invoiceNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Tahoma, sans-serif; direction: rtl; background: #f8fafc; color: #1e293b; padding: 2rem; }
    .wrapper { max-width: 800px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); overflow: hidden; }
    .header { background: linear-gradient(135deg,#1e40af,#3b82f6); color: #fff; padding: 2rem 2.5rem; display: flex; justify-content: space-between; align-items: flex-start; }
    .clinic-name { font-size: 1.75rem; font-weight: 700; }
    .clinic-sub { font-size: 0.875rem; opacity: 0.85; margin-top: 0.25rem; }
    .meta .lbl { font-size: 0.75rem; opacity: 0.75; text-transform: uppercase; }
    .meta .val { font-size: 1.125rem; font-weight: 600; }
    .body { padding: 2rem 2.5rem; }
    .sec-title { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.75px; color: #64748b; margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid #e2e8f0; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem; }
    .ib p { font-size: 0.875rem; color: #475569; margin-top: 0.25rem; }
    .ib strong { font-size: 1rem; color: #1e293b; display: block; margin-top: 0.125rem; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; font-size: 0.875rem; }
    thead th { background: #f1f5f9; padding: 0.75rem 1rem; text-align: right; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0; }
    tbody td { padding: 0.875rem 1rem; border-bottom: 1px solid #f1f5f9; color: #334155; }
    .totals { margin-top: 1rem; width: 280px; }
    .trow { display: flex; justify-content: space-between; padding: 0.5rem 0; font-size: 0.875rem; color: #475569; border-bottom: 1px dashed #e2e8f0; }
    .trow:last-child { border-bottom: none; font-weight: 700; font-size: 1rem; color: #1e293b; padding-top: 0.75rem; }
    .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
    .paid { background: #dcfce7; color: #166534; }
    .pending { background: #fef9c3; color: #713f12; }
    .refunded { background: #dbeafe; color: #1e40af; }
    .failed { background: #fee2e2; color: #991b1b; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 1.25rem 2.5rem; text-align: center; font-size: 0.75rem; color: #94a3b8; }
    @media print { body { background: white; padding: 0; } .wrapper { box-shadow: none; border-radius: 0; } }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div>
        <div class="clinic-name">${clinicName}</div>
        ${clinicPhone ? `<div class="clinic-sub">${clinicPhone}</div>` : ''}
      </div>
      <div class="meta">
        <div class="lbl">رقم الفاتورة</div>
        <div class="val">${invoice.invoiceNumber}</div>
        <div class="lbl" style="margin-top:0.75rem;">تاريخ الإصدار</div>
        <div class="val" style="font-size:0.9rem;">${fmtDate(invoice.createdAt)}</div>
      </div>
    </div>
    <div class="body">
      <div class="grid">
        <div>
          <div class="sec-title">بيانات المريض</div>
          <div class="ib">
            <p>الاسم</p><strong>${patientName}</strong>
            ${booking.patient?.email ? `<p style="margin-top:0.5rem;">البريد</p><strong>${booking.patient.email}</strong>` : ''}
            ${booking.patient?.phone ? `<p style="margin-top:0.5rem;">الجوال</p><strong>${booking.patient.phone}</strong>` : ''}
          </div>
        </div>
        <div>
          <div class="sec-title">بيانات الحجز</div>
          <div class="ib">
            <p>الطبيب / المختص</p><strong>${practitionerName}</strong>
            <p style="margin-top:0.5rem;">نوع الزيارة</p><strong>${TYPE_LABELS[booking.type] ?? booking.type}</strong>
            <p style="margin-top:0.5rem;">تاريخ الموعد</p><strong>${fmtDate(booking.date)} — ${booking.startTime}</strong>
          </div>
        </div>
      </div>
      <div class="sec-title">تفاصيل الخدمة</div>
      <table>
        <thead><tr><th>الخدمة</th><th>المبلغ</th><th>${vatLabel}</th><th>الإجمالي</th></tr></thead>
        <tbody>
          <tr>
            <td>${booking.service?.nameAr ?? booking.service?.nameEn ?? 'خدمة طبية'}</td>
            <td>${fmt(baseAmount)} ﷼</td>
            <td>${fmt(vatAmount)} ﷼</td>
            <td>${fmt(totalAmount)} ﷼</td>
          </tr>
        </tbody>
      </table>
      <div class="totals">
        <div class="trow"><span>المبلغ الأساسي</span><span>${fmt(baseAmount)} ﷼</span></div>
        <div class="trow"><span>${vatLabel}</span><span>${fmt(vatAmount)} ﷼</span></div>
        <div class="trow"><span>الإجمالي المستحق</span><span>${fmt(totalAmount)} ﷼</span></div>
      </div>
      <div style="margin-top:2rem;">
        <div class="sec-title">بيانات الدفع</div>
        <div style="display:flex;gap:2rem;flex-wrap:wrap;margin-top:0.5rem;">
          <div class="ib"><p>طريقة الدفع</p><strong>${METHOD_LABELS[payment.method] ?? payment.method}</strong></div>
          <div class="ib"><p>حالة الدفع</p><strong><span class="badge ${payment.status}">${STATUS_LABELS[payment.status] ?? payment.status}</span></strong></div>
          ${payment.transactionRef ? `<div class="ib"><p>رقم المرجع</p><strong>${payment.transactionRef}</strong></div>` : ''}
        </div>
      </div>
    </div>
    ${qrCodeData ? `
      <div style="padding:1.5rem 2.5rem;text-align:center;border-top:1px solid #e2e8f0;">
        <div class="sec-title" style="text-align:center;">رمز الاستجابة السريع (QR)</div>
        <canvas id="qr-canvas" style="margin-top:0.5rem;"></canvas>
      </div>
      <script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"><\/script>
      <script>
        (function() {
          var qr = qrcode(0, 'M');
          qr.addData('${qrCodeData}');
          qr.make();
          var canvas = document.getElementById('qr-canvas');
          var size = qr.getModuleCount();
          var cellSize = 4;
          var margin = 8;
          var total = size * cellSize + margin * 2;
          canvas.width = total;
          canvas.height = total;
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, total, total);
          ctx.fillStyle = '#000';
          for (var r = 0; r < size; r++) {
            for (var c = 0; c < size; c++) {
              if (qr.isDark(r, c)) {
                ctx.fillRect(c * cellSize + margin, r * cellSize + margin, cellSize, cellSize);
              }
            }
          }
        })();
      <\/script>
    ` : ''}
    <div class="footer">هذه الفاتورة صادرة إلكترونياً ولا تحتاج إلى توقيع أو ختم &nbsp;•&nbsp; ${clinicName}</div>
  </div>
</body>
</html>`;
}
