# Email HTML Layout — Design Spec
Date: 2026-04-08

## Summary

Add a global HTML email layout (header + footer) that wraps every outgoing email.
The layout is controlled by the clinic admin via a new "تصميم البريد" section in the Email Templates tab.
Layout config is stored as WhiteLabel EAV keys (no new DB table).
All emails switch from plain-text-only to HTML + text fallback.

---

## Decisions

- **Storage**: WhiteLabel EAV (`WhiteLabelConfig` table) — no new migration needed
- **HTML format**: Table-based layout (not CSS Grid/Flex) — required for Outlook/Gmail/Apple Mail compatibility
- **Mobile**: Responsive via `max-width: 600px` wrapper, inline CSS, `width: 100%` on all tables
- **Social icons**: Unicode text characters — no external image dependencies
- **Preview**: None — edit and save only
- **Unsubscribe**: Not included — all emails are transactional

---

## WhiteLabel Keys Added (via seed)

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `email_header_show_logo` | boolean | `true` | Show clinic logo in header |
| `email_header_show_name` | boolean | `true` | Show clinic name below logo in header |
| `email_footer_phone` | string | `""` | Contact phone number |
| `email_footer_website` | string | `""` | Clinic website URL |
| `email_footer_instagram` | string | `""` | Instagram profile URL |
| `email_footer_twitter` | string | `""` | Twitter/X profile URL |
| `email_footer_snapchat` | string | `""` | Snapchat profile URL |
| `email_footer_tiktok` | string | `""` | TikTok profile URL |
| `email_footer_linkedin` | string | `""` | LinkedIn profile URL |
| `email_footer_youtube` | string | `""` | YouTube channel URL |

Existing keys used (already in WhiteLabel): `logo_url`, `system_name`, `primary_color`.

---

## Backend Changes

### 1. `backend/src/modules/email/email.layout.ts` (new file)

Pure function — no dependencies, fully testable.

```ts
interface EmailLayoutConfig {
  clinicName: string
  logoUrl: string
  primaryColor: string
  showLogo: boolean
  showName: boolean
  footerPhone: string
  footerWebsite: string
  footerInstagram: string
  footerTwitter: string
  footerSnapchat: string
  footerTiktok: string
  footerLinkedin: string
  footerYoutube: string
}

function buildHtmlEmail(bodyEn: string, bodyAr: string, config: EmailLayoutConfig): string
```

HTML structure (table-based):
- Outer wrapper: `<table width="100%" bgcolor="#f4f4f4">`
- Inner container: `<table width="600" style="max-width:600px; width:100%">`
- Header table: background = `primaryColor`, contains logo img (if `showLogo`) + clinic name (if `showName`)
- Body table: white background, 32px padding, EN body + `<hr>` + AR body (RTL)
- Footer table: `#f8f8f8`, clinic name, phone + website, social links as Unicode text anchors

Body text conversion: `\n` → `<br>`, `{{var}}` already interpolated before this step.

Social icons mapping (Unicode):
```
Instagram → 📷  Twitter → 𝕏  Snapchat → 👻
TikTok → ♪  LinkedIn → in  YouTube → ▶
```

### 2. `backend/src/modules/email/email.processor.ts` (modified)

Add `WhitelabelService` injection.

In `process()`:
1. Fetch layout config via `whitelabelService.getPublicBranding()` + email-specific keys
2. Call `buildHtmlEmail(enBody, arBody, config)`
3. Change `sendMail({ to, subject, text })` → `sendMail({ to, subject, text, html })`

Text fallback remains unchanged (existing `buildPlainText` logic).

### 3. Seed file (modified)

Add 10 new `WhiteLabelConfig` rows with the keys listed above and empty/default values.

---

## Dashboard Changes

### 4. `dashboard/components/features/settings/email-layout-form.tsx` (new file)

Form component rendered inside `EmailTemplatesTab` when `email-layout` is selected in sidebar.

Fields:
- Header section: two `Switch` controls (`showLogo`, `showName`)
- Footer section: eight `Input` fields (phone, website, instagram, twitter, snapchat, tiktok, linkedin, youtube)
- Actions: Cancel + Save buttons

Uses existing `useBrandingConfig` / `useWhitelabelMutations` hooks (or a new `use-email-layout.ts` if those hooks don't cover batch PATCH of specific keys).

### 5. `dashboard/components/features/settings/email-templates-tab.tsx` (modified)

Add `email-layout` as the first item in the sidebar list (above the template list), visually separated by a divider.

When `email-layout` is selected, render `<EmailLayoutForm />` in the content panel instead of `TemplateView` / `InlineEditor`.

### 6. `dashboard/hooks/use-email-layout.ts` (new file)

TanStack Query hook:
- `useEmailLayout()` — GET specific WhiteLabel keys for email layout
- `useEmailLayoutMutations()` — PATCH those keys via existing WhiteLabel update endpoint

### 7. `dashboard/lib/api/email-layout.ts` (new file)

Network calls:
- `getEmailLayout()` — fetches the 10 email layout keys from `/whitelabel/config`
- `updateEmailLayout(data)` — PATCH `/whitelabel/config` with the changed keys

### 8. Translations (modified)

Add keys to `lib/translations/ar.settings.ts` and `lib/translations/en.settings.ts`:
```
settings.emailLayout.title
settings.emailLayout.header
settings.emailLayout.showLogo
settings.emailLayout.showName
settings.emailLayout.footer
settings.emailLayout.phone
settings.emailLayout.website
settings.emailLayout.instagram
settings.emailLayout.twitter
settings.emailLayout.snapchat
settings.emailLayout.tiktok
settings.emailLayout.linkedin
settings.emailLayout.youtube
settings.emailLayout.saved
```

---

## File Ownership (Agent Team)

| Agent | Files |
|-------|-------|
| Backend | `email.layout.ts` (new), `email.processor.ts` (mod), seed (mod) |
| Frontend | `email-layout-form.tsx` (new), `email-templates-tab.tsx` (mod), `use-email-layout.ts` (new), `lib/api/email-layout.ts` (new), translations (mod) |

---

## Out of Scope

- Email preview in dashboard
- Per-template layout overrides
- Unsubscribe links
- Dark mode email variant
- HTML editor for body (body remains plain-text with `\n` → `<br>` conversion)
