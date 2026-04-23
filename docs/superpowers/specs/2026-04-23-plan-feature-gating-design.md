# Plan & Feature Gating — Design Spec
**Date:** 2026-04-23  
**Status:** Approved  
**Scope:** Backend enforcement + Dashboard sidebar + shared types

---

## 1. Problem

CareKit has two independent systems that solve overlapping problems:

- **Plan.limits (JSON)** — quantitative quotas (`maxBranches`, `maxEmployees`) + some boolean flags (`chatbotEnabled`, `zatcaEnabled`, `ratingsEnabled`). Enforced by `PlanLimitsGuard` for BRANCHES and EMPLOYEES only.
- **FeatureFlag model** — per-org on/off switches (`organizationId` required), used by the dashboard sidebar (`featureFlag: "multi_branch"`). No link to plan tiers.

Result: no single source of truth for "does this org's plan include feature X?" The guard only covers two limits, boolean flags in Plan.limits are never enforced at the API layer, and the sidebar has no plan-awareness.

---

## 2. Goals

1. Unified enforcement: one guard, one endpoint, covers both on/off and quantitative features.
2. Backend is the security wall — UI omission is UX, not security.
3. Dashboard hides unavailable features completely — no lock icons, no upsell banners.
4. Quantitative limits hide the "+ Add" button when the limit is reached.
5. Redis-cached feature resolution (5 min TTL) — no per-request DB queries on hot paths.

---

## 3. Architecture Overview

```
@carekit/shared
  └─ FeatureKey enum (hardcoded, authoritative list)

Backend
  ├─ FeatureFlag table (Prisma)
  │    ├─ organizationId = null  → platform catalog (one row per FeatureKey)
  │    └─ organizationId = orgId → org override (beta/kill-switch)
  ├─ FeatureGuard  (replaces PlanLimitsGuard)
  │    └─ @RequireFeature(FeatureKey.X) decorator
  └─ GET /dashboard/billing/my-features
       └─ resolves plan + overrides → { features, limits } → Redis 5 min

Dashboard
  ├─ useBillingFeatures() hook  (TanStack Query, reads my-features)
  ├─ useSidebarNav()            (filters by features)
  └─ useQuantitativeLimit()     (hides + Add button)
```

---

## 4. Schema Changes

### 4.1 FeatureFlag model (platform.prisma)

**Current:** `organizationId String` (required) — pure per-org toggle.  
**New:** nullable organizationId + plan metadata fields.

```prisma
model FeatureFlag {
  id             String     @id @default(uuid())
  organizationId String?    // null = platform catalog; orgId = org override
  key            String
  enabled        Boolean    @default(true)

  // Platform-catalog fields (only on organizationId = null rows)
  allowedPlans   PlanSlug[] // [] = all plans; [PRO, ENTERPRISE] = restricted
  limitKind      String?    // pointer to Plan.limits JSON key (e.g. "maxBranches")

  nameAr         String
  nameEn         String
  descriptionAr  String?
  descriptionEn  String?
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  @@unique([organizationId, key])
  @@index([organizationId])
}
```

**Two-layer resolution:**
1. Check org override row (`organizationId = orgId, key = X`) — if exists, use `enabled` value.
2. Fall back to platform catalog row (`organizationId = null, key = X`) — check `enabled` AND `allowedPlans`.

### 4.2 Plan.limits JSON — cleanup

Remove the boolean fields that move to FeatureFlag catalog: `chatbotEnabled`, `zatcaEnabled`, `ratingsEnabled`, `websiteEnabled`, `customDomainEnabled`.  
Keep all quantitative keys (`maxBranches`, `maxEmployees`, `maxBookingsPerMonth`, `maxClients`, `maxStorageMB` and overage rates).

Migration: new Prisma migration only — existing Plan rows updated via seed script.

---

## 5. Shared Types (@carekit/shared)

```typescript
// packages/shared/src/constants/feature-keys.ts

export enum FeatureKey {
  // On/Off — PRO+
  RECURRING_BOOKINGS = 'recurring_bookings',
  WAITLIST           = 'waitlist',
  GROUP_SESSIONS     = 'group_sessions',
  AI_CHATBOT         = 'ai_chatbot',
  EMAIL_TEMPLATES    = 'email_templates',
  COUPONS            = 'coupons',

  // On/Off — ENTERPRISE only
  ADVANCED_REPORTS   = 'advanced_reports',
  INTAKE_FORMS       = 'intake_forms',
  ZATCA              = 'zatca',
  CUSTOM_ROLES       = 'custom_roles',
  ACTIVITY_LOG       = 'activity_log',

  // Quantitative (flag + limit)
  BRANCHES           = 'branches',
  EMPLOYEES          = 'employees',
  SERVICES           = 'services',
  MONTHLY_BOOKINGS   = 'monthly_bookings',
  STORAGE            = 'storage',
}

export type FeatureFlagKey = `${FeatureKey}`
```

`FeatureFlagKey` (string union) replaces the existing type in `@carekit/shared/constants` to stay backward-compatible with current sidebar-config imports.

---

## 6. Feature Matrix

### 6.1 On/Off Features

| Key | BASIC | PRO | ENTERPRISE | Notes |
|-----|-------|-----|------------|-------|
| RECURRING_BOOKINGS | ❌ | ✅ | ✅ | booking page visible; tab/option hidden |
| WAITLIST | ❌ | ✅ | ✅ | booking page visible; waitlist hidden |
| GROUP_SESSIONS | ❌ | ✅ | ✅ | booking page visible; group option hidden |
| AI_CHATBOT | ❌ | ✅ | ✅ | sidebar item hidden |
| EMAIL_TEMPLATES | ❌ | ✅ | ✅ | settings tab hidden |
| COUPONS | ❌ | ✅ | ✅ | sidebar item hidden |
| ADVANCED_REPORTS | ❌ | ❌ | ✅ | sidebar item hidden |
| INTAKE_FORMS | ❌ | ❌ | ✅ | sidebar item hidden |
| ZATCA | ❌ | ❌ | ✅ | sidebar item hidden; `enabled: false` globally until live |
| CUSTOM_ROLES | ❌ | ❌ | ✅ | settings tab hidden |
| ACTIVITY_LOG | ❌ | ❌ | ✅ | sidebar item hidden |

### 6.2 Quantitative Limits

| Key | BASIC | PRO | ENTERPRISE | Behavior at limit |
|-----|-------|-----|------------|-------------------|
| BRANCHES | 1 (flag off = page hidden) | 3 | -1 (∞) | + Add button hidden |
| EMPLOYEES | 5 | 20 | -1 (∞) | + Add button hidden |
| SERVICES | 10 | 50 | -1 (∞) | + Add button hidden |
| MONTHLY_BOOKINGS | 200 | 1000 | -1 (∞) | metered overage (not blocked) |
| STORAGE_GB | 1 | 10 | -1 (∞) | metered overage (not blocked) |

`-1` = unlimited (existing convention from Plan.limits).  
BRANCHES flag off (BASIC) = Branches page hidden entirely; value 1 is the default HQ branch that always exists.

### 6.3 Always Visible (no plan gating)

Dashboard, Bookings*, Clients, Employees*, Services*, Categories, Departments, Payments, Invoices, Notifications, Contact Messages, Content, Ratings, Branding**, Users, Settings

\* Page always visible; internal features or "+ Add" button obey plan limits above.  
\*\* Branding gated by RBAC permission `branding:edit`, not plan.

---

## 7. Backend Implementation

### 7.1 GET /dashboard/billing/my-features

New endpoint in `billing.controller.ts`:

```
GET /dashboard/billing/my-features
Response: {
  planSlug: PlanSlug,
  status: SubscriptionStatus,
  features: Record<FeatureKey, {
    enabled: boolean,
    limit?: number,       // present for quantitative features; -1 = unlimited
    currentCount?: number // present when limit is present; live DB count
  }>,
  // enabled: false            → feature unavailable (hide it)
  // enabled: true, no limit   → available, no quota
  // enabled: true, limit: N   → available, hard cap; currentCount provided
}
```

**Handler:** `GetMyFeaturesHandler` in `src/modules/platform/billing/get-my-features/`.

**Resolution logic:**
1. Load subscription (or default BASIC if none) from `SubscriptionCacheService`.
2. Load plan catalog features from Redis (key: `platform:features`) — populated at startup + invalidated on super-admin plan edit.
3. Load org overrides from Redis (key: `features:${orgId}`) — TTL 5 min.
4. Merge: org override `enabled` wins; plan catalog provides `allowedPlans` + `limitKind`; Plan.limits provides numeric value via `limitKind`.
5. For each quantitative feature (limitKind present): run a live `prisma.<model>.count` for `currentCount`.
6. Return flat map.

**Cache invalidation:**
- Plan CRUD (super-admin) → bust `platform:features`.
- Org override change → bust `features:${orgId}` (org override edits via existing super-admin action log flow; no new admin UI in this spec).
- Plan change (upgrade/downgrade) → bust `features:${orgId}` (subscription cache bust already done by existing handlers).

### 7.2 FeatureGuard (replaces PlanLimitsGuard)

```typescript
// src/modules/platform/billing/feature.guard.ts
@Injectable()
export class FeatureGuard implements CanActivate {
  // Reads @RequireFeature(FeatureKey.X) metadata
  // 1. No metadata → allow
  // 2. Resolve my-features for current tenant
  // 3. On/off: feature.enabled === false → 403
  // 4. Quantitative: feature.limit !== undefined →
  //      count current usage → if count >= limit → 403
}
```

```typescript
// src/modules/platform/billing/feature.decorator.ts
export const RequireFeature = (key: FeatureKey) =>
  SetMetadata(REQUIRE_FEATURE_KEY, key)
```

`PlanLimitsGuard` and `@EnforceLimit` decorator are **removed** after migration.

**Apply to existing endpoints:**

| Endpoint | Feature Key |
|----------|-------------|
| POST /bookings (recurring) | RECURRING_BOOKINGS |
| POST /bookings/waitlist | WAITLIST |
| POST /bookings (group) | GROUP_SESSIONS |
| POST /branches | BRANCHES (quantitative) |
| POST /employees | EMPLOYEES (quantitative) |
| POST /services | SERVICES (quantitative) |
| POST /coupons | COUPONS |
| GET /reports/* | ADVANCED_REPORTS |
| POST /intake-forms | INTAKE_FORMS |
| GET /ai/chat | AI_CHATBOT |
| POST /roles | CUSTOM_ROLES |
| GET /activity-log | ACTIVITY_LOG |
| GET /zatca/* | ZATCA |

### 7.3 Seed — Platform Feature Catalog

`prisma/seed.ts` upserts all FeatureFlag rows with `organizationId = null` on startup. Super-admin can toggle `enabled` per feature (kill-switch) via new admin endpoint.

---

## 8. Dashboard Implementation

### 8.1 useBillingFeatures() hook

```typescript
// hooks/use-billing-features.ts
export function useBillingFeatures() {
  // GET /dashboard/billing/my-features
  // staleTime: 5 * 60 * 1000 (matches Redis TTL)
  // returns { data, isLoading }
  // data.features[FeatureKey.X].enabled
  // data.features[FeatureKey.X].limit
}
```

### 8.2 useSidebarNav() — feature filtering

Extend existing permission filter to also check `item.featureFlag` against `features[key].enabled`:

```typescript
items: group.items.filter((item) => {
  if (item.permission && !user?.permissions?.includes(item.permission)) return false
  if (item.featureFlag && !features?.[item.featureFlag]?.enabled) return false
  return true
})
```

Loading state: render all items until features load (prevents sidebar flash).

### 8.3 sidebar-config.ts — additions

```typescript
// Add missing items:
{ titleKey: "nav.ratings",      href: "/ratings",       icon: StarIcon    },
{ titleKey: "nav.zatca",        href: "/zatca",         icon: ZatcaIcon,         featureFlag: "zatca"          },
{ titleKey: "nav.activityLog",  href: "/activity-log",  icon: ActivityIcon,      featureFlag: "activity_log"   },

// Change:
{ titleKey: "nav.branding", href: "/branding", icon: PaintBrush01Icon, permission: "branding:edit" },
// stays as-is (permission-based, not plan-based)

// Breaking change — existing featureFlag string keys renamed to match FeatureKey enum:
// "multi_branch" → "branches"          (sidebar-config.ts + shared FeatureFlagKey type)
// "intake_forms" → "intake_forms"      (no rename; catalog tier changes to ENTERPRISE)
// "coupons"      → "coupons"           (no rename)
// "reports"      → "advanced_reports"  (rename)
// "chatbot"      → "ai_chatbot"        (rename)
// All renaming done in a single commit: shared type + sidebar-config + catalog seed.
```

### 8.4 Quantitative limit in list pages

```typescript
// hooks/use-quantitative-limit.ts
export function useQuantitativeLimitReached(feature: FeatureKey): boolean {
  const { data } = useBillingFeatures()
  const entry = data?.features?.[feature]
  if (!entry?.enabled || entry.limit === undefined || entry.limit === -1) return false
  return entry.currentCount >= entry.limit
  // currentCount added to my-features response alongside limit
}
```

Usage: `const limitReached = useQuantitativeLimitReached(FeatureKey.EMPLOYEES)`  
→ hide "+ Add Employee" button when true, show brief inline message: "بلغت الحد الأقصى للخطة الحالية".

---

## 9. Mobile (Future)

Mobile apps consume the same `GET /dashboard/billing/my-features` equivalent via the mobile API. Enforcement is backend-only; mobile UI adaptation is deferred to a future phase. Backend `FeatureGuard` already protects mobile endpoints.

---

## 10. Migrations & Rollout

1. **Prisma migration:** alter `FeatureFlag` — make `organizationId` nullable, add `allowedPlans PlanSlug[]`, add `limitKind String?`.
2. **Data migration (in seed):** upsert platform catalog rows (organizationId=null) for all 11 on/off features + 5 quantitative features.
3. **Remove Plan.limits booleans:** new Plan migration strips `chatbotEnabled`, `zatcaEnabled`, `ratingsEnabled`, `websiteEnabled`, `customDomainEnabled` from all plan rows.
4. **Backend:** add `GetMyFeaturesHandler`, `FeatureGuard`, `@RequireFeature` decorator; remove `PlanLimitsGuard` + `@EnforceLimit`; wire guard on relevant endpoints.
5. **Dashboard:** add `useBillingFeatures()`, extend `useSidebarNav()`, add 3 sidebar items, add `useQuantitativeLimitReached()`, wire to list pages.
6. **Shared:** update `FeatureKey` enum + `FeatureFlagKey` type.

---

## 11. Out of Scope

- Mobile sidebar/UI adaptation (backend enforcement in scope).
- Beta/org override UI in dashboard (override rows exist in DB; no admin UI yet).
- Upsell / upgrade nudge UI — features are hidden, not locked.
- Plan pricing page / public marketing site.
- SMS, Zoom, Integrations — per-org credentials; not plan features.
- Bank transfer — available to all plans.
- Refunds — no external API call; not plan-gated.
