# Dashboard Settings Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align dashboard with the new 4-table backend config architecture — replace all old EAV whitelabel API calls with structured endpoints for WhiteLabelConfig, OrganizationSettings, ClinicIntegrations, and LicenseConfig.

**Architecture:** Bottom-up approach: types → API functions → hooks → query-keys → components → pages. Each layer only depends on layers below it. The old EAV key-value pattern (`WhiteLabelConfigMap`, `useConfigMap()`) is completely replaced with typed structured objects.

**Tech Stack:** Next.js 15, React 19, TanStack Query v5, shadcn/ui, Tailwind 4

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `dashboard/lib/types/organization-settings.ts` | OrganizationSettings + PublicOrganizationSettings types |
| `dashboard/lib/types/clinic-integrations.ts` | ClinicIntegrations type |
| `dashboard/lib/types/license.ts` | LicenseConfig + FeatureWithStatus types |
| `dashboard/lib/api/organization-settings.ts` | GET/PUT /organization-settings API functions |
| `dashboard/lib/api/clinic-integrations.ts` | GET/PUT /clinic-integrations API functions |
| `dashboard/lib/api/license.ts` | GET/PUT /license + GET /license/features |
| `dashboard/hooks/use-organization-settings.ts` | useOrganizationSettings + useUpdateOrganizationSettings hooks |
| `dashboard/hooks/use-clinic-integrations.ts` | useClinicIntegrations + useUpdateClinicIntegrations hooks |
| `dashboard/hooks/use-license.ts` | useLicense + useLicenseFeatures + useUpdateLicense hooks |
| `dashboard/components/features/settings/entity-tab.tsx` | Legal entity form (from organization-settings) |
| `dashboard/components/features/settings/legal-content-tab.tsx` | Bilingual legal content (from organization-settings) |

### Modified Files

| File | Change |
|------|--------|
| `dashboard/lib/types/whitelabel.ts` | Replace EAV types with structured WhiteLabelConfig + PublicBranding |
| `dashboard/lib/api/whitelabel.ts` | Replace EAV functions with GET/PUT /whitelabel + GET /whitelabel/public |
| `dashboard/hooks/use-whitelabel.ts` | Replace useConfigMap/useUpdateConfig with useWhitelabel/useUpdateWhitelabel |
| `dashboard/hooks/use-clinic-config.ts` | Read from useOrganizationSettings instead of useConfigMap |
| `dashboard/hooks/use-feature-flags.ts` | Handle 403 license error in mutation |
| `dashboard/lib/query-keys.ts` | Add organizationSettings, clinicIntegrations, license keys; update whitelabel |
| `dashboard/components/providers/branding-provider.tsx` | Update for camelCase response fields |
| `dashboard/components/features/white-label/branding-tab.tsx` | Read/write structured object instead of key-value map |
| `dashboard/components/features/white-label/wl-features-tab.tsx` | Show license status with licensed + enabled |
| `dashboard/components/features/settings/general-tab.tsx` | Read from useOrganizationSettings instead of configMap prop |
| `dashboard/components/features/settings/features-tab.tsx` | Show license status, disable unlicensed toggles |
| `dashboard/components/features/settings/email-layout-form.tsx` | Read from useOrganizationSettings |
| `dashboard/components/features/settings/settings-integrations-tab.tsx` | Read from useClinicIntegrations |
| `dashboard/components/features/settings/settings-payment-tab.tsx` | Read from useClinicIntegrations |
| `dashboard/app/(dashboard)/white-label/page.tsx` | Simplify to 2 tabs (branding + license) |
| `dashboard/app/(dashboard)/settings/page.tsx` | Add dynamic branding tab, new tabs, remove notifications |

### Deleted Files

| File | Reason |
|------|--------|
| `dashboard/components/features/white-label/entity-tab.tsx` | Moved to settings |
| `dashboard/components/features/white-label/technical-tab.tsx` | Merged into settings integrations |
| `dashboard/components/features/white-label/legal-tab.tsx` | Moved to settings |
| `dashboard/components/features/white-label/payment-tab.tsx` | Merged into settings integrations |
| `dashboard/components/features/white-label/integrations-tab.tsx` | Merged into settings integrations |
| `dashboard/components/features/settings/notifications-tab.tsx` | Config keys no longer exist |

---

## Task 1: Type Definitions

**Files:**
- Modify: `dashboard/lib/types/whitelabel.ts`
- Create: `dashboard/lib/types/organization-settings.ts`
- Create: `dashboard/lib/types/clinic-integrations.ts`
- Create: `dashboard/lib/types/license.ts`

- [ ] **Step 1: Replace whitelabel.ts types**

Replace entire `dashboard/lib/types/whitelabel.ts` with:

```typescript
/**
 * WhiteLabel Types — Deqah Dashboard
 * Structured singleton (no longer EAV key-value)
 */

export interface WhiteLabelConfig {
  id: string
  systemName: string
  systemNameAr: string
  logoUrl: string | null
  faviconUrl: string | null
  primaryColor: string
  secondaryColor: string
  fontFamily: string
  domain: string
  clinicCanEdit: boolean
  createdAt: string
  updatedAt: string
}

export type UpdateWhitelabelPayload = Partial<
  Omit<WhiteLabelConfig, "id" | "createdAt" | "updatedAt">
>

export interface PublicBranding {
  systemName: string
  systemNameAr: string
  logoUrl: string | null
  faviconUrl: string | null
  primaryColor: string
  secondaryColor: string
}
```

- [ ] **Step 2: Create organization-settings.ts**

Create `dashboard/lib/types/organization-settings.ts`:

```typescript
/**
 * Clinic Settings Types — Deqah Dashboard
 */

export interface OrganizationSettings {
  id: string
  companyNameAr: string | null
  companyNameEn: string | null
  businessRegistration: string | null
  vatRegistrationNumber: string | null
  vatRate: number
  sellerAddress: string | null
  clinicCity: string
  postalCode: string | null
  contactPhone: string | null
  contactEmail: string | null
  address: string | null
  socialMedia: Record<string, string> | null
  aboutAr: string | null
  aboutEn: string | null
  privacyPolicyAr: string | null
  privacyPolicyEn: string | null
  termsAr: string | null
  termsEn: string | null
  cancellationPolicyAr: string | null
  cancellationPolicyEn: string | null
  defaultLanguage: string
  timezone: string
  weekStartDay: string
  dateFormat: string
  timeFormat: string
  emailHeaderShowLogo: boolean
  emailHeaderShowName: boolean
  emailFooterPhone: string | null
  emailFooterWebsite: string | null
  emailFooterInstagram: string | null
  emailFooterTwitter: string | null
  emailFooterSnapchat: string | null
  emailFooterTiktok: string | null
  emailFooterLinkedin: string | null
  emailFooterYoutube: string | null
  sessionDuration: number
  reminderBeforeMinutes: number
  createdAt: string
  updatedAt: string
}

export type UpdateOrganizationSettingsPayload = Partial<
  Omit<OrganizationSettings, "id" | "createdAt" | "updatedAt">
>

export interface PublicOrganizationSettings {
  contactPhone: string | null
  contactEmail: string | null
  address: string | null
  socialMedia: Record<string, string> | null
  cancellationPolicyAr: string | null
  cancellationPolicyEn: string | null
}
```

- [ ] **Step 3: Create clinic-integrations.ts**

Create `dashboard/lib/types/clinic-integrations.ts`:

```typescript
/**
 * Clinic Integrations Types — Deqah Dashboard
 */

export interface ClinicIntegrations {
  id: string
  moyasarPublishableKey: string | null
  moyasarSecretKey: string | null
  bankName: string | null
  bankIban: string | null
  bankAccountHolder: string | null
  zoomClientId: string | null
  zoomClientSecret: string | null
  zoomAccountId: string | null
  emailProvider: string | null
  emailApiKey: string | null
  emailFrom: string | null
  openrouterApiKey: string | null
  firebaseConfig: Record<string, unknown> | null
  zatcaPhase: string
  zatcaCsid: string | null
  zatcaSecret: string | null
  zatcaPrivateKey: string | null
  zatcaRequestId: string | null
  createdAt: string
  updatedAt: string
}

export type UpdateClinicIntegrationsPayload = Partial<
  Omit<ClinicIntegrations, "id" | "createdAt" | "updatedAt">
>
```

- [ ] **Step 4: Create license.ts**

Create `dashboard/lib/types/license.ts`:

```typescript
/**
 * License Types — Deqah Dashboard
 */

export interface LicenseConfig {
  id: string
  hasCoupons: boolean
  hasGiftCards: boolean
  hasIntakeForms: boolean
  hasChatbot: boolean
  hasRatings: boolean
  hasMultiBranch: boolean
  hasReports: boolean
  hasRecurring: boolean
  hasWalkIn: boolean
  hasWaitlist: boolean
  hasZoom: boolean
  hasZatca: boolean
  createdAt: string
  updatedAt: string
}

export type UpdateLicensePayload = Partial<
  Omit<LicenseConfig, "id" | "createdAt" | "updatedAt">
>

export interface FeatureWithStatus {
  key: string
  licensed: boolean
  enabled: boolean
  nameAr: string
  nameEn: string
}
```

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/types/
git commit -m "feat(dashboard): add structured types for organization-settings, integrations, license"
```

---

## Task 2: API Functions

**Files:**
- Modify: `dashboard/lib/api/whitelabel.ts`
- Create: `dashboard/lib/api/organization-settings.ts`
- Create: `dashboard/lib/api/clinic-integrations.ts`
- Create: `dashboard/lib/api/license.ts`

- [ ] **Step 1: Replace whitelabel.ts API**

Replace entire `dashboard/lib/api/whitelabel.ts` with:

```typescript
/**
 * WhiteLabel API — Deqah Dashboard
 */

import { api } from "@/lib/api"
import type { WhiteLabelConfig, UpdateWhitelabelPayload, PublicBranding } from "@/lib/types/whitelabel"

/* ─── Queries ─── */

export async function fetchWhitelabel(): Promise<WhiteLabelConfig> {
  return api.get<WhiteLabelConfig>("/whitelabel")
}

export async function fetchPublicBranding(): Promise<PublicBranding> {
  return api.get<PublicBranding>("/whitelabel/public")
}

/* ─── Mutations ─── */

export async function updateWhitelabel(
  data: UpdateWhitelabelPayload,
): Promise<WhiteLabelConfig> {
  return api.put<WhiteLabelConfig>("/whitelabel", data)
}
```

- [ ] **Step 2: Create organization-settings.ts API**

Create `dashboard/lib/api/organization-settings.ts`:

```typescript
/**
 * Clinic Settings API — Deqah Dashboard
 */

import { api } from "@/lib/api"
import type {
  OrganizationSettings,
  UpdateOrganizationSettingsPayload,
  PublicOrganizationSettings,
} from "@/lib/types/organization-settings"

/* ─── Queries ─── */

export async function fetchOrganizationSettings(): Promise<OrganizationSettings> {
  return api.get<OrganizationSettings>("/organization-settings")
}

export async function fetchOrganizationSettingsPublic(): Promise<PublicOrganizationSettings> {
  return api.get<PublicOrganizationSettings>("/organization-settings/public")
}

/* ─── Mutations ─── */

export async function updateOrganizationSettings(
  data: UpdateOrganizationSettingsPayload,
): Promise<OrganizationSettings> {
  return api.put<OrganizationSettings>("/organization-settings", data)
}
```

- [ ] **Step 3: Create clinic-integrations.ts API**

Create `dashboard/lib/api/clinic-integrations.ts`:

```typescript
/**
 * Clinic Integrations API — Deqah Dashboard
 */

import { api } from "@/lib/api"
import type {
  ClinicIntegrations,
  UpdateClinicIntegrationsPayload,
} from "@/lib/types/clinic-integrations"

/* ─── Queries ─── */

export async function fetchClinicIntegrations(): Promise<ClinicIntegrations> {
  return api.get<ClinicIntegrations>("/clinic-integrations")
}

/* ─── Mutations ─── */

export async function updateClinicIntegrations(
  data: UpdateClinicIntegrationsPayload,
): Promise<ClinicIntegrations> {
  return api.put<ClinicIntegrations>("/clinic-integrations", data)
}
```

- [ ] **Step 4: Create license.ts API**

Create `dashboard/lib/api/license.ts`:

```typescript
/**
 * License API — Deqah Dashboard
 */

import { api } from "@/lib/api"
import type {
  LicenseConfig,
  UpdateLicensePayload,
  FeatureWithStatus,
} from "@/lib/types/license"

/* ─── Queries ─── */

export async function fetchLicense(): Promise<LicenseConfig> {
  return api.get<LicenseConfig>("/license")
}

export async function fetchLicenseFeatures(): Promise<FeatureWithStatus[]> {
  return api.get<FeatureWithStatus[]>("/license/features")
}

/* ─── Mutations ─── */

export async function updateLicense(
  data: UpdateLicensePayload,
): Promise<LicenseConfig> {
  return api.put<LicenseConfig>("/license", data)
}
```

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/api/
git commit -m "feat(dashboard): add API functions for organization-settings, integrations, license"
```

---

## Task 3: Query Keys + Hooks

**Files:**
- Modify: `dashboard/lib/query-keys.ts`
- Modify: `dashboard/hooks/use-whitelabel.ts`
- Create: `dashboard/hooks/use-organization-settings.ts`
- Create: `dashboard/hooks/use-clinic-integrations.ts`
- Create: `dashboard/hooks/use-license.ts`
- Modify: `dashboard/hooks/use-clinic-config.ts`
- Modify: `dashboard/hooks/use-feature-flags.ts`

- [ ] **Step 1: Update query-keys.ts**

In `dashboard/lib/query-keys.ts`, replace the whitelabel section (lines ~210-215) and organizationSettings section (lines ~238-242) with:

```typescript
  /* ─── WhiteLabel ─── */
  whitelabel: {
    all: ["whitelabel"] as const,
    config: () => ["whitelabel", "config"] as const,
  },

  /* ─── Clinic Settings ─── */
  organizationSettings: {
    all: ["organization-settings"] as const,
    config: () => ["organization-settings", "config"] as const,
    public: () => ["organization-settings", "public"] as const,
    bookingFlowOrder: () => ["organization-settings", "booking-flow-order"] as const,
    payment: () => ["organization-settings", "payment"] as const,
  },

  /* ─── Clinic Integrations ─── */
  clinicIntegrations: {
    all: ["clinic-integrations"] as const,
    config: () => ["clinic-integrations", "config"] as const,
  },

  /* ─── License ─── */
  license: {
    all: ["license"] as const,
    config: () => ["license", "config"] as const,
    features: () => ["license", "features"] as const,
  },
```

Remove the old `configMap` key from whitelabel.

- [ ] **Step 2: Rewrite use-whitelabel.ts**

Replace entire `dashboard/hooks/use-whitelabel.ts`:

```typescript
"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { fetchWhitelabel, updateWhitelabel } from "@/lib/api/whitelabel"
import type { UpdateWhitelabelPayload } from "@/lib/types/whitelabel"

export function useWhitelabel() {
  return useQuery({
    queryKey: queryKeys.whitelabel.config(),
    queryFn: fetchWhitelabel,
    staleTime: 10 * 60 * 1000,
  })
}

export function useUpdateWhitelabel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateWhitelabelPayload) => updateWhitelabel(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.whitelabel.all })
    },
  })
}
```

- [ ] **Step 3: Create use-organization-settings.ts**

Create `dashboard/hooks/use-organization-settings.ts`:

```typescript
"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { fetchOrganizationSettings, updateOrganizationSettings } from "@/lib/api/organization-settings"
import type { UpdateOrganizationSettingsPayload } from "@/lib/types/organization-settings"

export function useOrganizationSettings() {
  return useQuery({
    queryKey: queryKeys.organizationSettings.config(),
    queryFn: fetchOrganizationSettings,
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdateOrganizationSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateOrganizationSettingsPayload) => updateOrganizationSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizationSettings.all })
    },
  })
}
```

- [ ] **Step 4: Create use-clinic-integrations.ts**

Create `dashboard/hooks/use-clinic-integrations.ts`:

```typescript
"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchClinicIntegrations,
  updateClinicIntegrations,
} from "@/lib/api/clinic-integrations"
import type { UpdateClinicIntegrationsPayload } from "@/lib/types/clinic-integrations"

export function useClinicIntegrations() {
  return useQuery({
    queryKey: queryKeys.clinicIntegrations.config(),
    queryFn: fetchClinicIntegrations,
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdateClinicIntegrations() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateClinicIntegrationsPayload) =>
      updateClinicIntegrations(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.clinicIntegrations.all,
      })
    },
  })
}
```

- [ ] **Step 5: Create use-license.ts**

Create `dashboard/hooks/use-license.ts`:

```typescript
"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchLicense,
  fetchLicenseFeatures,
  updateLicense,
} from "@/lib/api/license"
import type { UpdateLicensePayload } from "@/lib/types/license"

export function useLicense() {
  return useQuery({
    queryKey: queryKeys.license.config(),
    queryFn: fetchLicense,
    staleTime: 10 * 60 * 1000,
  })
}

export function useLicenseFeatures() {
  return useQuery({
    queryKey: queryKeys.license.features(),
    queryFn: fetchLicenseFeatures,
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdateLicense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateLicensePayload) => updateLicense(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.license.all })
    },
  })
}
```

- [ ] **Step 6: Rewrite use-clinic-config.ts**

Replace entire `dashboard/hooks/use-clinic-config.ts`:

```typescript
"use client"

import { useOrganizationSettings } from "@/hooks/use-organization-settings"
import { formatClinicDate, formatClinicTime, getWeekStartDay } from "@/lib/utils"
import type { DateFormat, TimeFormat } from "@/lib/utils"

export function useClinicConfig() {
  const { data: settings } = useOrganizationSettings()

  const dateFormat = (settings?.dateFormat ?? "Y-m-d") as DateFormat
  const timeFormat = (settings?.timeFormat ?? "24h") as TimeFormat
  const weekStartDay = (settings?.weekStartDay ?? "sunday") as "sunday" | "monday"
  const timezone = settings?.timezone ?? "Asia/Riyadh"

  return {
    dateFormat,
    timeFormat,
    weekStartDay,
    timezone,
    weekStartDayNumber: getWeekStartDay(weekStartDay),
    formatDate: (date: Date | string) => formatClinicDate(date, dateFormat),
    formatTime: (time: string) => formatClinicTime(time, timeFormat),
  }
}
```

- [ ] **Step 7: Update use-feature-flags.ts — handle 403**

In `dashboard/hooks/use-feature-flags.ts`, find the `useFeatureFlagMutation()` function and add 403 handling in the `onError` callback. Add to the mutation options:

```typescript
onError: (error: Error & { response?: { status?: number } }) => {
  if (error.response?.status === 403) {
    toast.error("هذه الميزة غير متاحة في رخصتك. تواصل مع فريق Deqah.")
  } else {
    toast.error("حدث خطأ أثناء تحديث الميزة")
  }
},
```

- [ ] **Step 8: Commit**

```bash
git add dashboard/lib/query-keys.ts dashboard/hooks/
git commit -m "feat(dashboard): add hooks for organization-settings, integrations, license"
```

---

## Task 4: Branding Provider Update

**Files:**
- Modify: `dashboard/components/providers/branding-provider.tsx`

- [ ] **Step 1: Update fetchBranding response parsing**

In `dashboard/components/providers/branding-provider.tsx`, the `fetchBranding()` function reads `data.primary_color` and `data.secondary_color` (snake_case from old EAV). The new endpoint returns camelCase. Update:

```typescript
// Replace (around line 94-95):
// OLD:
const primary = data.primary_color
const accent = data.secondary_color

// NEW:
const primary = data.primaryColor ?? data.primary_color
const accent = data.secondaryColor ?? data.secondary_color
```

Using fallback to support both old and new responses during transition.

- [ ] **Step 2: Commit**

```bash
git add dashboard/components/providers/branding-provider.tsx
git commit -m "fix(dashboard): update branding provider for camelCase response"
```

---

## Task 5: Rewrite White-Label Page + Components

**Files:**
- Modify: `dashboard/app/(dashboard)/white-label/page.tsx`
- Modify: `dashboard/components/features/white-label/branding-tab.tsx`
- Modify: `dashboard/components/features/white-label/wl-features-tab.tsx`
- Delete: `dashboard/components/features/white-label/entity-tab.tsx`
- Delete: `dashboard/components/features/white-label/technical-tab.tsx`
- Delete: `dashboard/components/features/white-label/legal-tab.tsx`
- Delete: `dashboard/components/features/white-label/payment-tab.tsx`
- Delete: `dashboard/components/features/white-label/integrations-tab.tsx`

- [ ] **Step 1: Rewrite white-label/page.tsx**

The page should have 2 tabs only (branding + license). Read the current file first, then replace to use `useWhitelabel()` and `useUpdateWhitelabel()` hooks instead of direct API calls. Remove all tab imports except BrandingTab and WlFeaturesTab.

Key changes:
- Import `useWhitelabel`, `useUpdateWhitelabel` from hooks
- Import only BrandingTab and WlFeaturesTab
- Render 2 tabs instead of 5
- Pass structured WhiteLabelConfig to BrandingTab (not configMap)

- [ ] **Step 2: Rewrite branding-tab.tsx**

The branding tab currently receives `configMap: WhiteLabelConfigMap` and reads keys like `configMap["system_name"]`. Rewrite to receive `whitelabel: WhiteLabelConfig` and read typed fields like `whitelabel.systemName`.

Key changes:
- Props: `{ whitelabel: WhiteLabelConfig; onSave: (data: UpdateWhitelabelPayload) => void; isSaving: boolean }`
- Initialize state from `whitelabel.systemName`, `whitelabel.primaryColor`, etc.
- onSave builds an `UpdateWhitelabelPayload` object (not key-value array)
- Social media links move to settings (remove from this tab if present)

- [ ] **Step 3: Rewrite wl-features-tab.tsx**

Rewrite to show license management (licensed + enabled status). Use `useLicenseFeatures()` and `useUpdateLicense()`.

Key changes:
- Import `useLicenseFeatures` and `useUpdateLicense` from hooks
- Each feature row shows: name, licensed toggle (Deqah controls), enabled state
- Licensed=false → feature is greyed out, cannot be enabled at runtime

- [ ] **Step 4: Delete old white-label components**

```bash
rm dashboard/components/features/white-label/entity-tab.tsx
rm dashboard/components/features/white-label/technical-tab.tsx
rm dashboard/components/features/white-label/legal-tab.tsx
rm dashboard/components/features/white-label/payment-tab.tsx
rm dashboard/components/features/white-label/integrations-tab.tsx
```

- [ ] **Step 5: Commit**

```bash
git add dashboard/app/(dashboard)/white-label/ dashboard/components/features/white-label/
git commit -m "refactor(dashboard): simplify white-label page to branding + license tabs"
```

---

## Task 6: New Settings Components

**Files:**
- Create: `dashboard/components/features/settings/entity-tab.tsx`
- Create: `dashboard/components/features/settings/legal-content-tab.tsx`

- [ ] **Step 1: Create entity-tab.tsx**

Create `dashboard/components/features/settings/entity-tab.tsx` — legal entity form reading from `useOrganizationSettings()`:

Fields: companyNameAr, companyNameEn, businessRegistration, vatRegistrationNumber, vatRate, sellerAddress, clinicCity, postalCode.

Follow the pattern of existing settings tabs (general-tab.tsx): card layout with form fields, save button at bottom. Use `useOrganizationSettings()` and `useUpdateOrganizationSettings()` hooks internally.

- [ ] **Step 2: Create legal-content-tab.tsx**

Create `dashboard/components/features/settings/legal-content-tab.tsx` — bilingual legal text.

Fields: aboutAr/En, privacyPolicyAr/En, termsAr/En, cancellationPolicyAr/En.

Use BilingualTextCard pattern (AR/EN textareas side by side). Use `useOrganizationSettings()` and `useUpdateOrganizationSettings()` hooks.

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/features/settings/entity-tab.tsx dashboard/components/features/settings/legal-content-tab.tsx
git commit -m "feat(dashboard): add entity and legal content tabs for settings"
```

---

## Task 7: Update Existing Settings Components

**Files:**
- Modify: `dashboard/components/features/settings/general-tab.tsx`
- Modify: `dashboard/components/features/settings/features-tab.tsx`
- Modify: `dashboard/components/features/settings/email-layout-form.tsx`
- Modify: `dashboard/components/features/settings/settings-integrations-tab.tsx`
- Modify: `dashboard/components/features/settings/settings-payment-tab.tsx`
- Delete: `dashboard/components/features/settings/notifications-tab.tsx`

- [ ] **Step 1: Update general-tab.tsx**

Currently receives `configMap: WhiteLabelConfigMap` prop and reads keys like `configMap["contact_email"]`. Rewrite to use `useOrganizationSettings()` hook internally:

- Remove `configMap` and `onSave` props
- Use `useOrganizationSettings()` and `useUpdateOrganizationSettings()` hooks directly
- Read typed fields: `settings.contactEmail`, `settings.timezone`, etc.
- Save builds `UpdateOrganizationSettingsPayload` object

- [ ] **Step 2: Update features-tab.tsx**

Add license status display. Use `useLicenseFeatures()` alongside `useFeatureFlagMutation()`:

- Show "licensed" badge or "not licensed" badge per feature
- Disable toggle for unlicensed features
- Add tooltip: "هذه الميزة غير متاحة في رخصتك"
- 403 error already handled in hook (Task 3 Step 7)

- [ ] **Step 3: Update email-layout-form.tsx**

Currently uses `useConfigMap()` and `useUpdateConfig()`. Replace with `useOrganizationSettings()` and `useUpdateOrganizationSettings()`:

- Replace `configMap["email_header_show_logo"]` with `settings.emailHeaderShowLogo`
- Replace `configMap["email_footer_phone"]` with `settings.emailFooterPhone`
- Save sends `UpdateOrganizationSettingsPayload` with email fields only

- [ ] **Step 4: Update settings-integrations-tab.tsx**

Currently uses `useConfigMap()` and `useUpdateConfig()`. Replace with `useClinicIntegrations()` and `useUpdateClinicIntegrations()`:

- Read typed fields: `integrations.zoomClientId`, `integrations.emailProvider`, etc.
- Masked fields (`***`) handled by only sending changed fields

- [ ] **Step 5: Update settings-payment-tab.tsx**

Currently uses `useConfigMap()` and `useUpdateConfig()` for payment keys. Replace with `useClinicIntegrations()` and `useUpdateClinicIntegrations()`:

- Read: `integrations.moyasarPublishableKey`, `integrations.bankName`, `integrations.bankIban`
- Keep BookingSettings payment flags (paymentMoyasarEnabled, paymentAtClinicEnabled) unchanged

- [ ] **Step 6: Delete notifications-tab.tsx**

```bash
rm dashboard/components/features/settings/notifications-tab.tsx
```

- [ ] **Step 7: Commit**

```bash
git add dashboard/components/features/settings/
git commit -m "refactor(dashboard): update settings components for new config APIs"
```

---

## Task 8: Update Settings Page

**Files:**
- Modify: `dashboard/app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Rewrite settings/page.tsx**

Major changes:
- Import `useWhitelabel` (to check `clinicCanEdit`)
- Import new tab components (EntityTab, LegalContentTab)
- Remove notifications tab import
- Dynamic tab list based on `clinicCanEdit`:

```tsx
const { data: whitelabel } = useWhitelabel()

const tabs = [
  ...(whitelabel?.clinicCanEdit ? [{ value: "branding", label: "البراندنق" }] : []),
  { value: "general", label: "عام" },
  { value: "entity", label: "الكيان القانوني" },
  { value: "legal", label: "المحتوى القانوني" },
  { value: "integrations", label: "التكاملات" },
  { value: "email-layout", label: "تخطيط البريد" },
  { value: "features", label: "الميزات" },
  { value: "booking", label: "الحجوزات" },
  { value: "hours", label: "ساعات العمل" },
  { value: "templates", label: "قوالب البريد" },
]
```

- Remove `useConfigMap()` / `useUpdateConfig()` usage (no longer needed at page level — each tab uses its own hook)
- Branding tab renders same BrandingTab component from white-label

- [ ] **Step 2: Commit**

```bash
git add dashboard/app/(dashboard)/settings/page.tsx
git commit -m "refactor(dashboard): update settings page with new tabs and dynamic branding"
```

---

## Task 9: Cleanup + TypeCheck

- [ ] **Step 1: Delete old test files that reference removed APIs**

```bash
rm dashboard/test/unit/lib/whitelabel-api.spec.ts
rm dashboard/test/unit/hooks/use-whitelabel.spec.tsx
```

These tests tested the old EAV API functions which no longer exist. New tests should be written in a follow-up.

- [ ] **Step 2: Search for remaining old imports**

Search for any remaining references to old types/functions:

```bash
grep -r "WhiteLabelConfigMap\|useConfigMap\|useUpdateConfig\|fetchConfigMap\|fetchConfig()\|ConfigValueType\|UpsertConfigItem\|UpdateConfigPayload" dashboard/ --include="*.ts" --include="*.tsx" -l
```

Fix any remaining files that still import old types/functions.

- [ ] **Step 3: Run typecheck**

```bash
cd dashboard && npm run typecheck
```

Fix any type errors.

- [ ] **Step 4: Commit fixes**

```bash
git add -A
git commit -m "fix(dashboard): clean up remaining old whitelabel references"
```
