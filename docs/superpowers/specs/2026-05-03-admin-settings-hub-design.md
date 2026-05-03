---
date: 2026-05-03
topic: Admin Settings Hub — Notifications & Security Pages
status: approved
---

# Admin Settings Hub — Notifications & Security Pages

## Scope

Complete and polish two existing super-admin settings pages:
1. `apps/admin/app/(admin)/settings/notifications/page.tsx` — notification defaults + FCM credentials
2. `apps/admin/app/(admin)/settings/security/page.tsx` — session TTL, 2FA, IP allowlist

Both pages have fully working backend endpoints. The work is frontend-only.

## What Changes

### 1. Fix API path in notifications.api.ts

`apps/admin/features/notifications-settings/notifications-settings.api.ts`

- Change `/notifications-config` → `/admin/notifications-config` (matches the backend controller path)

### 2. Notifications page — polish only

`apps/admin/app/(admin)/settings/notifications/page.tsx`

The page logic is already complete. Changes:
- Replace hardcoded English strings with `useTranslations('settings.notifications')` — keys already exist in both `messages/ar.json` and `messages/en.json`
- Replace raw `<input type="checkbox">` with styled checkbox using Tailwind design-system classes consistent with rest of admin (border-input, rounded, accent-primary)
- Replace raw `<input type="number">` and `<select>` with styled inputs using `border-input bg-background` tokens
- Keep all existing state logic, toggleChannel, handleSave, loading/error/success states unchanged

### 3. Security page — complete implementation

`apps/admin/app/(admin)/settings/security/page.tsx`

Currently a skeleton with no error handling. Needs:

**State additions:**
- `error: string | null` — populated on load failure or save failure
- `success: boolean` — shown briefly after successful save
- `loading: boolean` — for initial data fetch

**Loading state:**
- 3 × `h-16 rounded-lg border border-border bg-muted animate-pulse` skeleton divs

**Error state (load failure):**
- `<div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">` showing the error

**Error state (save failure):**
- Same destructive banner below the form

**Success feedback:**
- `<div className="rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success">` after successful save

**Fix the save handler:**
- Wrap in try/catch, set `error` on failure, set `success` on success
- Replace `catch(console.error)` on load with `setError(...)` + `setLoading(false)`

**i18n:**
- Use `useTranslations('settings.security')` — add new keys (see i18n section below)
- Replace all hardcoded English strings

**Styling:**
- Match notifications page: `rounded-lg border border-border p-6 space-y-4` card sections
- Each field in its own card section (Session TTL card, 2FA card, IP Allowlist card)
- Save button: `inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50`

### 4. i18n keys — security namespace

Add under `settings.security` in both `messages/en.json` and `messages/ar.json`:

**English:**
```json
"security": {
  "title": "Security Settings",
  "description": "Super-admin session and access controls.",
  "sessionTtl": {
    "title": "Session TTL",
    "label": "Session TTL (minutes)",
    "hint": "JWT lifetime for super-admin sessions (15–1440 min)"
  },
  "twoFactor": {
    "title": "Two-Factor Authentication",
    "label": "Require 2FA for all super-admins"
  },
  "ipAllowlist": {
    "title": "IP Allowlist",
    "label": "IP Allowlist (one CIDR per line, empty = allow all)"
  },
  "save": "Save Security Settings",
  "saving": "Saving…",
  "saveSuccess": "Security settings saved successfully.",
  "loadError": "Failed to load security settings.",
  "saveError": "Failed to save security settings."
}
```

**Arabic:**
```json
"security": {
  "title": "إعدادات الأمان",
  "description": "التحكم في جلسات وصلاحيات مدير المنصة.",
  "sessionTtl": {
    "title": "مدة الجلسة",
    "label": "مدة الجلسة (دقيقة)",
    "hint": "عمر JWT لجلسات مدير المنصة (15–1440 دقيقة)"
  },
  "twoFactor": {
    "title": "المصادقة الثنائية",
    "label": "إلزام المصادقة الثنائية لجميع مديري المنصة"
  },
  "ipAllowlist": {
    "title": "قائمة IP المسموحة",
    "label": "قائمة IP المسموحة (CIDR واحد لكل سطر، فارغ = السماح للجميع)"
  },
  "save": "حفظ إعدادات الأمان",
  "saving": "جارٍ الحفظ…",
  "saveSuccess": "تم حفظ إعدادات الأمان بنجاح.",
  "loadError": "فشل تحميل إعدادات الأمان.",
  "saveError": "فشل حفظ إعدادات الأمان."
}
```

## Files Changed

| File | Change |
|------|--------|
| `apps/admin/features/notifications-settings/notifications-settings.api.ts` | Fix API path |
| `apps/admin/app/(admin)/settings/notifications/page.tsx` | Add i18n + styled inputs |
| `apps/admin/app/(admin)/settings/security/page.tsx` | Complete implementation |
| `apps/admin/messages/en.json` | Add `settings.security` keys |
| `apps/admin/messages/ar.json` | Add `settings.security` keys |

## Files NOT Changed

- `apps/admin/app/(admin)/settings/layout.tsx` — tabs nav stays as-is
- Any backend files — endpoints are complete
- `apps/admin/features/security-settings/security-settings.api.ts` — path already correct
- Any other admin pages

## Definition of Done

- Both pages load data from backend without 404
- Both pages show skeleton while loading
- Both pages show error banner on fetch failure
- Both pages show success banner after save
- All strings go through `useTranslations` (no hardcoded EN strings)
- AR translation keys exist and render correctly
- Inputs use design-system Tailwind tokens (border-input, bg-background, etc.)
- `apps/admin` typechecks clean (`npm run typecheck` in `apps/admin`)
