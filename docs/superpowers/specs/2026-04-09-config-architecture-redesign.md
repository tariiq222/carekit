# Config Architecture Redesign — 4-Table Separation

**Date:** 2026-04-09
**Status:** Draft
**Scope:** Backend (NestJS + Prisma)

## Context

CareKit is a white-label product sold as perpetual licenses to clinics. Each clinic gets its own deployment. Two distinct ownership levels exist:

- **CareKit (product owner)**: Sets branding, feature availability per license deal, delivers the system
- **Clinic (license holder)**: Manages all operational settings, integrations, and compliance after delivery

Currently, 60+ config keys are stored in a single `WhiteLabelConfig` EAV table with no ownership distinction. Multiple services bypass `WhitelabelService` and query the table directly. `WhitelabelService.getPublicBranding()` reaches into `BookingSettings`. No separation between license-level and runtime feature flags.

## Decision

Split into 4 structured tables, each with a dedicated module and clear ownership.

## Data Model

### Table 1: `WhiteLabelConfig` — Product Identity (CareKit controls)

Singleton row. Read-only for clinic unless `clinicCanEdit = true` (e.g., government entity with full rights).

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `id` | UUID | auto | PK |
| `systemName` | String | "CareKit Clinic" | English display name |
| `systemNameAr` | String | "عيادة كيركت" | Arabic display name |
| `logoUrl` | String? | null | Logo image URL |
| `faviconUrl` | String? | null | Favicon URL |
| `primaryColor` | String | "#2563EB" | Primary brand hex |
| `secondaryColor` | String | "#1E40AF" | Secondary brand hex |
| `fontFamily` | String | "Inter" | Font family |
| `domain` | String | "localhost" | Deployment domain |
| `clinicCanEdit` | Boolean | false | Unlocks editing for special clients |

**Table name:** `white_label_config`

### Table 2: `LicenseConfig` — Feature Availability (CareKit controls)

Singleton row. Determines which features the clinic is licensed to use. Clinic cannot modify.

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `id` | UUID | auto | PK |
| `hasCoupons` | Boolean | true | |
| `hasGiftCards` | Boolean | true | |
| `hasIntakeForms` | Boolean | true | |
| `hasChatbot` | Boolean | true | |
| `hasRatings` | Boolean | true | |
| `hasMultiBranch` | Boolean | true | |
| `hasReports` | Boolean | true | |
| `hasRecurring` | Boolean | true | |
| `hasWalkIn` | Boolean | true | |
| `hasWaitlist` | Boolean | true | |
| `hasZoom` | Boolean | false | Off by default |
| `hasZatca` | Boolean | true | |

**Table name:** `license_config`

**Feature evaluation:** `featureEnabled = LicenseConfig.has{Feature} AND FeatureFlag.enabled`

The existing `FeatureFlag` table remains as a runtime toggle. `FeatureFlagService.toggle()` checks `LicenseConfig` before allowing activation — returns 403 if the feature is not licensed.

### Table 3: `OrganizationSettings` — Clinic Operational Settings (Clinic controls)

Singleton row. Everything the clinic manages day-to-day.

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| **Legal Entity** | | | |
| `companyNameAr` | String? | null | Arabic legal name |
| `companyNameEn` | String? | null | English legal name |
| `businessRegistration` | String? | null | Commercial Registration (CR) |
| `vatRegistrationNumber` | String? | null | 15-digit VAT number |
| `vatRate` | Decimal | 15 | VAT percentage |
| `sellerAddress` | String? | null | Invoice address |
| `clinicCity` | String | "الرياض" | Invoice city |
| `postalCode` | String? | null | Postal code |
| **Contact** | | | |
| `contactPhone` | String? | null | |
| `contactEmail` | String? | null | |
| `address` | String? | null | Physical address |
| `socialMedia` | Json? | null | `{ twitter, instagram, whatsapp, linkedin }` |
| **Legal Content** | | | |
| `aboutAr` | Text? | null | |
| `aboutEn` | Text? | null | |
| `privacyPolicyAr` | Text? | null | |
| `privacyPolicyEn` | Text? | null | |
| `termsAr` | Text? | null | |
| `termsEn` | Text? | null | |
| `cancellationPolicyAr` | Text? | null | |
| `cancellationPolicyEn` | Text? | null | |
| **Localization** | | | |
| `defaultLanguage` | String | "ar" | |
| `timezone` | String | "Asia/Riyadh" | IANA timezone |
| `weekStartDay` | String | "sunday" | |
| `dateFormat` | String | "Y-m-d" | |
| `timeFormat` | String | "24h" | |
| **Email Branding** | | | |
| `emailHeaderShowLogo` | Boolean | true | |
| `emailHeaderShowName` | Boolean | true | |
| `emailFooterPhone` | String? | null | |
| `emailFooterWebsite` | String? | null | |
| `emailFooterInstagram` | String? | null | |
| `emailFooterTwitter` | String? | null | |
| `emailFooterSnapchat` | String? | null | |
| `emailFooterTiktok` | String? | null | |
| `emailFooterLinkedin` | String? | null | |
| `emailFooterYoutube` | String? | null | |
| **Operations** | | | |
| `sessionDuration` | Int | 30 | Default minutes |
| `reminderBeforeMinutes` | Int | 60 | |

**Table name:** `clinic_settings`

### Table 4: `ClinicIntegrations` — API Keys & Credentials (Clinic controls)

Singleton row. All third-party integration credentials. Sensitive fields are encrypted at rest and masked in API responses.

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| **Payment (Moyasar)** | | | |
| `moyasarPublishableKey` | String? | null | |
| `moyasarSecretKey` | String? | null | Encrypted |
| **Bank** | | | |
| `bankName` | String? | null | |
| `bankIban` | String? | null | Encrypted |
| `bankAccountHolder` | String? | null | Encrypted |
| **Zoom** | | | |
| `zoomClientId` | String? | null | |
| `zoomClientSecret` | String? | null | Encrypted |
| `zoomAccountId` | String? | null | |
| **Email** | | | |
| `emailProvider` | String? | null | |
| `emailApiKey` | String? | null | Encrypted |
| `emailFrom` | String? | null | |
| **AI** | | | |
| `openrouterApiKey` | String? | null | Encrypted |
| **Firebase** | | | |
| `firebaseConfig` | Json? | null | |
| **ZATCA** | | | |
| `zatcaPhase` | String | "phase1" | phase1 or phase2 |
| `zatcaCsid` | String? | null | Encrypted |
| `zatcaSecret` | String? | null | Encrypted |
| `zatcaPrivateKey` | String? | null | Encrypted |
| `zatcaRequestId` | String? | null | |

**Table name:** `clinic_integrations`

**Masked fields in GET responses:**
`moyasarSecretKey`, `bankIban`, `bankAccountHolder`, `emailApiKey`, `zoomClientSecret`, `openrouterApiKey`, `zatcaCsid`, `zatcaSecret`, `zatcaPrivateKey`

## Module Structure

```
backend/src/modules/
├── whitelabel/            → WhiteLabelConfig CRUD
├── license/               → LicenseConfig CRUD + feature evaluation
├── organization-settings/       → OrganizationSettings CRUD
├── clinic-integrations/   → ClinicIntegrations CRUD (with masking)
├── feature-flags/         → FeatureFlag runtime toggle (checked against LicenseConfig)
├── clinic/                → ClinicWorkingHours + ClinicHolidays (unchanged)
└── bookings/              → BookingSettings (unchanged)
```

## API Endpoints

### WhiteLabelModule
```
GET  /whitelabel/public     → No auth — branding for mobile/widget
GET  /whitelabel            → whitelabel:view
PUT  /whitelabel            → whitelabel:edit (rejects if clinicCanEdit = false)
```

### LicenseModule
```
GET  /license               → license:view
PUT  /license               → license:edit (super-admin only, CareKit team)
GET  /license/features      → license:view — licensed features + runtime state
```

### OrganizationSettingsModule
```
GET  /organization-settings           → organization-settings:view
PUT  /organization-settings           → organization-settings:edit
GET  /organization-settings/public    → No auth — contact, social, cancellation policy
```

### ClinicIntegrationsModule
```
GET  /clinic-integrations       → clinic-integrations:view (masked)
PUT  /clinic-integrations       → clinic-integrations:edit
```

### FeatureFlagModule (updated)
```
GET    /feature-flags           → feature-flags:view — all flags with license + runtime state
PATCH  /feature-flags/:key      → feature-flags:toggle — checks LicenseConfig first
```

## Permissions

| Module | Permission | Who |
|--------|-----------|-----|
| `whitelabel` | `whitelabel:view` | All authenticated |
| `whitelabel` | `whitelabel:edit` | CareKit team (or clinic if `clinicCanEdit`) |
| `license` | `license:view` | Admin |
| `license` | `license:edit` | CareKit team only |
| `organization-settings` | `organization-settings:view` | Admin |
| `organization-settings` | `organization-settings:edit` | Admin |
| `clinic-integrations` | `clinic-integrations:view` | Admin |
| `clinic-integrations` | `clinic-integrations:edit` | Admin |
| `feature-flags` | `feature-flags:view` | Admin |
| `feature-flags` | `feature-flags:toggle` | Admin (within license bounds) |

## Consumer Rewiring

Services that currently bypass `WhitelabelService` and query `WhiteLabelConfig` directly will be updated:

| Consumer | Before | After |
|----------|--------|-------|
| `ZatcaService` | `WhiteLabelConfig` direct (7 keys) | `OrganizationSettingsService` (VAT, CR, address) + `ClinicIntegrationsService` (ZATCA credentials) |
| `InvoiceCreatorService` | `WhiteLabelConfig` direct (2 keys) | `WhitelabelService` (systemName) + `OrganizationSettingsService` (contact) |
| `ChatbotContextService` | `WhiteLabelConfig` direct (1 key) | `WhitelabelService` (systemName) |
| `OrganizationSettingsService` (old) | `WhiteLabelConfig` direct (bank) | Deleted — `ClinicIntegrationsService` handles bank |
| `BookingCreationService` | `WhitelabelService.getTimezone()` | `OrganizationSettingsService.getTimezone()` |
| `ReminderService` | `WhitelabelService.getTimezone()` | `OrganizationSettingsService.getTimezone()` |
| `WhitelabelService.getPublicBranding()` | `BookingSettings` direct | Removed — returns branding only |

## Cache Strategy

| Table | Cache Key | TTL | Invalidation |
|-------|-----------|-----|-------------|
| `WhiteLabelConfig` | `wl:branding` | 60 min | On PUT |
| `LicenseConfig` | `wl:license` | 60 min | On PUT |
| `OrganizationSettings` | `clinic:settings` | 10 min | On PUT |
| `ClinicIntegrations` | `clinic:integrations` | 30 min | On PUT |
| Feature evaluation | `feature:{key}` | 5 min | On LicenseConfig or FeatureFlag change |

## Data Migration

1. Create 4 new tables (Prisma migration)
2. Migration script reads all key-value pairs from old `WhiteLabelConfig` EAV table and maps to structured fields
3. Seed `LicenseConfig` from current `FeatureFlag.enabled` values
4. Old `WhiteLabelConfig` EAV table marked deprecated (no writes)
5. After verification — drop old table + `ConfigValueType` enum

### Key Mapping (old EAV key → new table.field)

**→ WhiteLabelConfig:**
`system_name` → `systemName`, `system_name_ar` → `systemNameAr`, `logo_url` → `logoUrl`, `favicon_url` → `faviconUrl`, `primary_color` → `primaryColor`, `secondary_color` → `secondaryColor`, `font` → `fontFamily`, `domain` → `domain`

**→ OrganizationSettings:**
`company_name_ar` → `companyNameAr`, `company_name_en` → `companyNameEn`, `business_registration` → `businessRegistration`, `vat_registration_number` → `vatRegistrationNumber`, `vat_rate` → `vatRate`, `seller_address` → `sellerAddress`, `clinic_city` → `clinicCity`, `postal_code` → `postalCode`, `contact_phone` → `contactPhone`, `contact_email` → `contactEmail`, `address` → `address`, `social_media` → `socialMedia`, `about_ar` → `aboutAr`, `about_en` → `aboutEn`, `privacy_policy_ar` → `privacyPolicyAr`, `privacy_policy_en` → `privacyPolicyEn`, `terms_ar` → `termsAr`, `terms_en` → `termsEn`, `cancellation_policy` → `cancellationPolicyEn`, `cancellation_policy_ar` → `cancellationPolicyAr`, `default_language` → `defaultLanguage`, `timezone` → `timezone`, `week_start_day` → `weekStartDay`, `date_format` → `dateFormat`, `time_format` → `timeFormat`, `email_header_show_logo` → `emailHeaderShowLogo`, `email_header_show_name` → `emailHeaderShowName`, `email_footer_*` → corresponding fields, `session_duration` → `sessionDuration`, `reminder_before_minutes` → `reminderBeforeMinutes`

**→ ClinicIntegrations:**
`moyasar_api_key` → `moyasarPublishableKey`, `moyasar_secret_key` → `moyasarSecretKey`, `bank_account_name` → `bankAccountHolder`, `bank_account_number` → (dropped, IBAN is sufficient), `bank_iban` → `bankIban`, `zoom_api_key` → `zoomClientId`, `zoom_api_secret` → `zoomClientSecret`, `email_api_key` → `emailApiKey`, `openrouter_api_key` → `openrouterApiKey`, `firebase_config` → `firebaseConfig`, `zatca_phase` → `zatcaPhase`, `zatca_csid` → `zatcaCsid`, `zatca_secret` → `zatcaSecret`, `zatca_private_key` → `zatcaPrivateKey`, `zatca_request_id` → `zatcaRequestId`

**→ LicenseConfig:**
Seeded from current `FeatureFlag` rows: each `FeatureFlag.key` maps to `LicenseConfig.has{PascalCase(key)}` with value from `FeatureFlag.enabled`.

## Existing Tables — No Changes

- `BookingSettings` — stays as-is (40+ fields, multi-branch support)
- `ClinicWorkingHours` — stays as-is
- `ClinicHoliday` — stays as-is
- `FeatureFlag` — stays as runtime toggle, gains license check guard
- `EmailTemplate` — stays as-is

## Dashboard Impact

The dashboard settings pages will need to be updated to call the new endpoints:

- `/dashboard/white-label` → splits into tabs calling different APIs
  - **Branding tab** → `GET/PUT /whitelabel`
  - **License tab** → `GET /license/features` (read-only for clinic, shows what's licensed)
  - **Clinic Info tab** → `GET/PUT /organization-settings`
  - **Integrations tab** → `GET/PUT /clinic-integrations`
  - **Features tab** → `GET /feature-flags` + `PATCH /feature-flags/:key`

Dashboard implementation is out of scope for this spec — backend first.
