/**
 * HTML Email Layout Builder.
 * Table-based layout for maximum email client compatibility.
 * Responsive: max-width 600px, inline CSS, mobile-safe font sizes.
 */

export interface EmailLayoutConfig {
  clinicName: string;
  clinicNameAr: string;
  logoUrl: string;
  primaryColor: string;
  showLogo: boolean;
  showName: boolean;
  footerPhone: string;
  footerWebsite: string;
  footerInstagram: string;
  footerTwitter: string;
  footerSnapchat: string;
  footerTiktok: string;
  footerLinkedin: string;
  footerYoutube: string;
}

interface SocialLink {
  url: string;
  label: string;
}

function buildSocialLinks(config: EmailLayoutConfig): SocialLink[] {
  const links: SocialLink[] = [];
  if (config.footerInstagram) links.push({ url: config.footerInstagram, label: 'Instagram' });
  if (config.footerTwitter) links.push({ url: config.footerTwitter, label: 'X' });
  if (config.footerSnapchat) links.push({ url: config.footerSnapchat, label: 'Snapchat' });
  if (config.footerTiktok) links.push({ url: config.footerTiktok, label: 'TikTok' });
  if (config.footerLinkedin) links.push({ url: config.footerLinkedin, label: 'LinkedIn' });
  if (config.footerYoutube) links.push({ url: config.footerYoutube, label: 'YouTube' });
  return links;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function textToHtml(text: string): string {
  return escapeHtml(text).replace(/\n/g, '<br>');
}

function buildHeader(config: EmailLayoutConfig): string {
  if (!config.showLogo && !config.showName) return '';

  const logoHtml = config.showLogo && config.logoUrl
    ? `<img src="${escapeHtml(config.logoUrl)}" alt="${escapeHtml(config.clinicName)}" width="120" style="display:block;margin:0 auto;max-width:120px;height:auto;">`
    : '';

  const nameHtml = config.showName
    ? `<p style="margin:8px 0 0;font-size:18px;font-weight:600;color:#ffffff;">${escapeHtml(config.clinicName)}</p>`
    : '';

  return `
    <tr>
      <td style="background-color:${escapeHtml(config.primaryColor)};padding:24px 32px;text-align:center;">
        ${logoHtml}
        ${nameHtml}
      </td>
    </tr>`;
}

function buildFooter(config: EmailLayoutConfig): string {
  const parts: string[] = [];

  // Clinic name
  parts.push(
    `<p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#333333;">${escapeHtml(config.clinicNameAr)}</p>`,
  );

  // Phone + Website
  const contactParts: string[] = [];
  if (config.footerPhone) {
    contactParts.push(
      `<a href="tel:${escapeHtml(config.footerPhone)}" style="color:#666666;text-decoration:none;">${escapeHtml(config.footerPhone)}</a>`,
    );
  }
  if (config.footerWebsite) {
    contactParts.push(
      `<a href="${escapeHtml(config.footerWebsite)}" style="color:#666666;text-decoration:none;">${escapeHtml(config.footerWebsite)}</a>`,
    );
  }
  if (contactParts.length > 0) {
    parts.push(`<p style="margin:0 0 12px;font-size:12px;color:#666666;">${contactParts.join(' &nbsp;|&nbsp; ')}</p>`);
  }

  // Social links
  const socials = buildSocialLinks(config);
  if (socials.length > 0) {
    const socialHtml = socials
      .map(
        (s) =>
          `<a href="${escapeHtml(s.url)}" style="color:${escapeHtml(config.primaryColor)};text-decoration:none;font-size:12px;font-weight:500;margin:0 6px;">${escapeHtml(s.label)}</a>`,
      )
      .join(' ');
    parts.push(`<p style="margin:0;">${socialHtml}</p>`);
  }

  return `
    <tr>
      <td style="background-color:#f4f4f5;padding:20px 32px;text-align:center;border-top:1px solid #e4e4e7;">
        ${parts.join('\n        ')}
      </td>
    </tr>`;
}

export function buildHtmlEmail(
  bodyEn: string,
  bodyAr: string,
  config: EmailLayoutConfig,
): string {
  const header = buildHeader(config);
  const footer = buildFooter(config);

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(config.clinicName)}</title>
  <!--[if mso]><style>table{border-collapse:collapse;}td{font-family:Arial,sans-serif;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          ${header}
          <tr>
            <td style="padding:32px;font-size:15px;line-height:1.7;color:#1a1a1a;">
              <div dir="ltr" style="text-align:left;margin-bottom:24px;">
                ${textToHtml(bodyEn)}
              </div>
              <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0;">
              <div dir="rtl" style="text-align:right;">
                ${textToHtml(bodyAr)}
              </div>
            </td>
          </tr>
          ${footer}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
