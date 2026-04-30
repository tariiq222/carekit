# Dashboard Settings Redesign — Config Architecture Alignment

**Date:** 2026-04-09
**Status:** Draft
**Scope:** Dashboard (Next.js)
**Depends on:** Backend PR #5 (config architecture redesign — merged)

## Context

The backend split the monolithic WhiteLabelConfig EAV table into 4 structured tables with separate endpoints. The dashboard still calls the old endpoints (`/whitelabel/config/map`, `/whitelabel/config`, etc.) which no longer exist. This spec aligns the dashboard with the new backend API.

## Two Pages

### `/white-label` — Deqah team only (deployment setup)

Visible only to users with `whitelabel:edit` permission. Used during initial setup.

**Tabs:**
1. **Branding** — system_name, system_name_ar, logo, favicon, colors, font, domain
   - Endpoint: `GET /whitelabel` + `PUT /whitelabel`
2. **License** — feature availability per license deal (read/write for Deqah)
   - Endpoint: `GET /license/features` + `PUT /license`
   - Shows each feature with licensed (boolean) + runtime enabled status

### `/settings` — Clinic admin (daily operations)

Visible to users with `organization-settings:view` permission.

**Tabs:**
1. **Branding** (conditional) — appears only when `clinicCanEdit = true` from `GET /whitelabel`
   - Same branding form as white-label page
   - Endpoint: `GET /whitelabel` + `PUT /whitelabel`
2. **General** — contact info (phone, email, address, social) + localization (timezone, language, date/time format, week start)
   - Endpoint: `GET /organization-settings` + `PUT /organization-settings`
3. **Legal Entity** — company_name_ar/en, CR, VAT number, seller_address, clinic_city, postal_code
   - Endpoint: `GET /organization-settings` + `PUT /organization-settings`
4. **Legal Content** — about, privacy policy, terms, cancellation policy (bilingual)
   - Endpoint: `GET /organization-settings` + `PUT /organization-settings`
5. **Integrations** — Moyasar keys, bank details, Zoom, email provider, Firebase, OpenRouter, ZATCA credentials
   - Endpoint: `GET /clinic-integrations` + `PUT /clinic-integrations`
   - Sensitive fields display as `***`, skip on save if unchanged
6. **Email Layout** — header show logo/name, footer links (phone, website, social)
   - Endpoint: `GET /organization-settings` + `PUT /organization-settings`
7. **Features** — runtime feature toggles (bounded by license)
   - Endpoint: `GET /license/features` (shows licensed + enabled state) + `PATCH /feature-flags/:key`
   - Disabled toggle + tooltip for unlicensed features
   - Handle 403 from backend when trying to enable unlicensed feature
8. **Booking** — unchanged (BookingSettings endpoints)
9. **Working Hours** — unchanged
10. **Email Templates** — unchanged

## API Layer

### New Files

**`dashboard/lib/api/organization-settings.ts`**
```typescript
fetchOrganizationSettings(): Promise<OrganizationSettings>     // GET /organization-settings
updateOrganizationSettings(data): Promise<OrganizationSettings> // PUT /organization-settings
fetchOrganizationSettingsPublic(): Promise<PublicOrganizationSettings> // GET /organization-settings/public
```

**`dashboard/lib/api/clinic-integrations.ts`**
```typescript
fetchClinicIntegrations(): Promise<ClinicIntegrations>     // GET /clinic-integrations (masked)
updateClinicIntegrations(data): Promise<ClinicIntegrations> // PUT /clinic-integrations
```

**`dashboard/lib/api/license.ts`**
```typescript
fetchLicense(): Promise<LicenseConfig>                     // GET /license
updateLicense(data): Promise<LicenseConfig>                // PUT /license
fetchLicenseFeatures(): Promise<FeatureWithStatus[]>       // GET /license/features
```

### Modified Files

**`dashboard/lib/api/whitelabel.ts`** — Replace all functions:
```typescript
fetchWhitelabel(): Promise<WhiteLabelConfig>       // GET /whitelabel
updateWhitelabel(data): Promise<WhiteLabelConfig>  // PUT /whitelabel
fetchPublicBranding(): Promise<PublicBranding>      // GET /whitelabel/public
```
Remove: fetchConfig(), fetchConfigMap(), fetchConfigByKey(), deleteConfig() — EAV endpoints no longer exist.

**`dashboard/lib/api/feature-flags.ts`** — No endpoint changes. Keep as-is.

**`dashboard/lib/api/widget.ts`** — Update `fetchWidgetBranding()` return type. Response no longer includes booking settings fields (payment_moyasar_enabled, widget_show_price, etc.). Widget settings come from `/booking-settings/public` or similar.

## Type Definitions

### New Files

**`dashboard/lib/types/organization-settings.ts`**
```typescript
export interface OrganizationSettings {
  id: string;
  companyNameAr: string | null;
  companyNameEn: string | null;
  businessRegistration: string | null;
  vatRegistrationNumber: string | null;
  vatRate: number;
  sellerAddress: string | null;
  clinicCity: string;
  postalCode: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  address: string | null;
  socialMedia: Record<string, string> | null;
  aboutAr: string | null;
  aboutEn: string | null;
  privacyPolicyAr: string | null;
  privacyPolicyEn: string | null;
  termsAr: string | null;
  termsEn: string | null;
  cancellationPolicyAr: string | null;
  cancellationPolicyEn: string | null;
  defaultLanguage: string;
  timezone: string;
  weekStartDay: string;
  dateFormat: string;
  timeFormat: string;
  emailHeaderShowLogo: boolean;
  emailHeaderShowName: boolean;
  emailFooterPhone: string | null;
  emailFooterWebsite: string | null;
  emailFooterInstagram: string | null;
  emailFooterTwitter: string | null;
  emailFooterSnapchat: string | null;
  emailFooterTiktok: string | null;
  emailFooterLinkedin: string | null;
  emailFooterYoutube: string | null;
  sessionDuration: number;
  reminderBeforeMinutes: number;
}

export interface PublicOrganizationSettings {
  contactPhone: string | null;
  contactEmail: string | null;
  address: string | null;
  socialMedia: Record<string, string> | null;
  cancellationPolicyAr: string | null;
  cancellationPolicyEn: string | null;
}
```

**`dashboard/lib/types/clinic-integrations.ts`**
```typescript
export interface ClinicIntegrations {
  id: string;
  moyasarPublishableKey: string | null;
  moyasarSecretKey: string | null;    // masked as '***'
  bankName: string | null;
  bankIban: string | null;            // masked
  bankAccountHolder: string | null;   // masked
  zoomClientId: string | null;
  zoomClientSecret: string | null;    // masked
  zoomAccountId: string | null;
  emailProvider: string | null;
  emailApiKey: string | null;         // masked
  emailFrom: string | null;
  openrouterApiKey: string | null;    // masked
  firebaseConfig: Record<string, unknown> | null;
  zatcaPhase: string;
  zatcaCsid: string | null;          // masked
  zatcaSecret: string | null;        // masked
  zatcaPrivateKey: string | null;    // masked
  zatcaRequestId: string | null;
}
```

**`dashboard/lib/types/license.ts`**
```typescript
export interface LicenseConfig {
  id: string;
  hasCoupons: boolean;
  hasGiftCards: boolean;
  hasIntakeForms: boolean;
  hasChatbot: boolean;
  hasRatings: boolean;
  hasMultiBranch: boolean;
  hasReports: boolean;
  hasRecurring: boolean;
  hasWalkIn: boolean;
  hasWaitlist: boolean;
  hasZoom: boolean;
  hasZatca: boolean;
}

export interface FeatureWithStatus {
  key: string;
  licensed: boolean;
  enabled: boolean;
  nameAr: string;
  nameEn: string;
}
```

### Modified Files

**`dashboard/lib/types/whitelabel.ts`** — Replace with:
```typescript
export interface WhiteLabelConfig {
  id: string;
  systemName: string;
  systemNameAr: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  domain: string;
  clinicCanEdit: boolean;
}

export interface PublicBranding {
  systemName: string;
  systemNameAr: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
}
```
Remove: ConfigValueType, WhiteLabelConfigMap, UpsertConfigItem, UpdateConfigPayload.

## Hooks

### New Files

**`dashboard/hooks/use-organization-settings.ts`**
- `useOrganizationSettings()` — fetches `GET /organization-settings`, staleTime: 5 min
- `useUpdateOrganizationSettings()` — mutation for `PUT /organization-settings`, invalidates organization-settings queries

**`dashboard/hooks/use-clinic-integrations.ts`**
- `useClinicIntegrations()` — fetches `GET /clinic-integrations` (masked), staleTime: 5 min
- `useUpdateClinicIntegrations()` — mutation for `PUT /clinic-integrations`, invalidates clinic-integrations queries

**`dashboard/hooks/use-license.ts`**
- `useLicense()` — fetches `GET /license`, staleTime: 10 min
- `useLicenseFeatures()` — fetches `GET /license/features`, staleTime: 5 min
- `useUpdateLicense()` — mutation for `PUT /license`, invalidates license queries

### Modified Files

**`dashboard/hooks/use-whitelabel.ts`** — Replace:
- `useWhitelabel()` — fetches `GET /whitelabel` (structured object), staleTime: 10 min
- `useUpdateWhitelabel()` — mutation for `PUT /whitelabel`, invalidates whitelabel queries
- Remove: useConfigMap(), useUpdateConfig()

**`dashboard/hooks/use-clinic-config.ts`** — Rewrite:
- Read timezone, dateFormat, timeFormat, weekStartDay from `useOrganizationSettings()` instead of `useConfigMap()`
- Same formatDate(), formatTime() helpers

**`dashboard/hooks/use-feature-flags.ts`** — Minor update:
- `useFeatureFlagMutation()` should handle 403 error (license not available) with toast message

## Query Keys

**`dashboard/lib/query-keys.ts`** — Update:
```typescript
whitelabel: {
  all: ["whitelabel"] as const,
  config: () => ["whitelabel", "config"] as const,
},
organizationSettings: {
  all: ["organization-settings"] as const,
  config: () => ["organization-settings", "config"] as const,
  public: () => ["organization-settings", "public"] as const,
},
clinicIntegrations: {
  all: ["clinic-integrations"] as const,
  config: () => ["clinic-integrations", "config"] as const,
},
license: {
  all: ["license"] as const,
  config: () => ["license", "config"] as const,
  features: () => ["license", "features"] as const,
},
```

## Component Changes

### `/white-label/page.tsx` — Simplify

Two tabs only:
1. Branding — uses `useWhitelabel()` + `useUpdateWhitelabel()`
2. License — uses `useLicenseFeatures()` + `useUpdateLicense()`

### `/settings/page.tsx` — Expand

Dynamic tab list based on `clinicCanEdit`:
```tsx
const { data: whitelabel } = useWhitelabel();
const tabs = [
  ...(whitelabel?.clinicCanEdit ? [{ value: 'branding', label: 'البراندنق' }] : []),
  { value: 'general', label: 'عام' },
  { value: 'entity', label: 'الكيان القانوني' },
  { value: 'legal', label: 'المحتوى القانوني' },
  { value: 'integrations', label: 'التكاملات' },
  { value: 'email-layout', label: 'تخطيط البريد' },
  { value: 'features', label: 'الميزات' },
  { value: 'booking', label: 'الحجوزات' },
  { value: 'hours', label: 'ساعات العمل' },
  { value: 'templates', label: 'قوالب البريد' },
];
```

### White-label components — Delete/Keep

- **Keep**: `branding-tab.tsx` (shared between white-label and settings)
- **Rewrite**: `wl-features-tab.tsx` → license management (licensed toggles, not just runtime)
- **Delete**: `entity-tab.tsx`, `technical-tab.tsx`, `legal-tab.tsx`, `payment-tab.tsx`, `integrations-tab.tsx` — replaced by settings components

### Settings components — New/Modify

- **Modify**: `general-tab.tsx` — read from `useOrganizationSettings()` instead of `useConfigMap()`
- **New**: `entity-tab.tsx` — legal entity fields from `useOrganizationSettings()`
- **New**: `legal-content-tab.tsx` — bilingual legal text from `useOrganizationSettings()`
- **New**: `integrations-tab.tsx` — all API keys from `useClinicIntegrations()` (with masked fields)
- **New**: `email-layout-tab.tsx` — header/footer settings from `useOrganizationSettings()`
- **Modify**: `features-tab.tsx` — show license status, disable unlicensed toggles, handle 403

### Branding Provider

**`dashboard/components/providers/branding-provider.tsx`** — Update:
- `GET /whitelabel/public` response is now `{ systemName, systemNameAr, logoUrl, faviconUrl, primaryColor, secondaryColor }` only
- Remove booking settings fields from the provider's type/state

## Masked Fields Handling (Integrations)

The `GET /clinic-integrations` returns sensitive fields as `***`. On save:
- Track which fields the user actually modified
- Only send modified fields in the PUT request
- Or: send all fields but backend already skips `***` values

## Files to Delete

- `dashboard/lib/types/whitelabel.ts` old types (ConfigValueType, WhiteLabelConfigMap, UpsertConfigItem)
- `dashboard/components/features/white-label/entity-tab.tsx` (moved to settings)
- `dashboard/components/features/white-label/technical-tab.tsx` (merged into integrations)
- `dashboard/components/features/white-label/legal-tab.tsx` (moved to settings)
- `dashboard/components/features/white-label/payment-tab.tsx` (merged into integrations)
- `dashboard/components/features/white-label/integrations-tab.tsx` (merged into settings integrations)

## Existing Tabs — No Changes

- Booking tab (BookingSettings endpoints)
- Working Hours tab (ClinicWorkingHours endpoints)
- Widget tab (reads from BookingSettings, not WhiteLabelConfig)
- Email Templates tab

## Notifications Tab — Removal

The notifications tab reads config keys like `notify_new_bookings`, `notify_cancellations`, etc. from the old WhiteLabelConfig map. These keys were not migrated to any new table (backend now always returns notifications as enabled). The notifications tab should be removed from settings until a proper notification preferences system is designed. This is out of scope for this spec.

## Testing

- All existing hooks tests need updating for new API shapes
- New hooks need tests (useOrganizationSettings, useClinicIntegrations, useLicense)
- E2E tests for settings page tabs
