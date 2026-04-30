# Deqah Brand Architecture

Date: 2026-05-01

## Locked Decision

Deqah / دِقة is the platform brand.

Tenant brands, such as Sawaa / سواء, are customer-facing brands on public websites and locked mobile builds.

## Platform Brand

- English: Deqah
- Arabic: دِقة
- Arabic tagline: نظام إدارة المواعيد والحجوزات للمنشآت
- English tagline: Scheduling and appointment operations platform
- Primary color: #354FD8
- Accent color: #82CC17

Source of truth: `packages/shared/constants/brand.ts`

## Tenant Brand

Tenant-facing surfaces must prefer `PublicBranding`:

- `organizationNameAr`
- `organizationNameEn`
- `logoUrl`
- `faviconUrl`
- `colorPrimary`
- `colorAccent`
- `fontFamily`
- `activeWebsiteTheme`

## Current Mobile Build

The current mobile build is locked to Sawaa:

- App name: سواء للإرشاد الأسري
- Scheme: sawa
- Bundle: sa.sawa.app

Therefore mobile user-facing copy should say Sawaa, not Deqah, unless the copy is explicitly about the platform provider.

## Forbidden in Production UI

- CareKit
- CAREKIT
- carekit
- كيركيت
- كير كت

Run `pnpm brand:check` to enforce this automatically.
