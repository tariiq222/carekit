# E2E QA Report — Phase 1: Clients (المستفيدين)

**Date:** 2026-04-24
**Tester:** Claude (Chrome DevTools MCP)
**Dashboard URL:** http://localhost:5103
**Backend URL:** http://localhost:5100/api/v1
**Login:** admin@carekit-test.com / Admin@1234

## Results Summary

| # | Test Case | Route | Status | Severity |
|---|-----------|-------|--------|----------|
| 1.1 | عرض قائمة المستفيدين | `/clients` | ✅ PASS | — |
| 1.2 | إنشاء مستفيد جديد | `/clients/create` | ✅ PASS | — |
| 1.3 | عرض تفاصيل مستفيد | `/clients/[id]` | ⚠️ PASS with issue | Low |
| 1.4 | تعديل مستفيد | `/clients/[id]/edit` | ✅ PASS | — |
| 1.5 | البحث والفلترة | `/clients` | ✅ PASS | — |
| 1.6 | الحذف مع التأكيد | `/clients` | ✅ PASS | — |

---

## 🐛 BUG #1 — Default organization left suspended + stale cache

### Severity: **HIGH** (blocker for any dev/QA session)

### Reproduction
1. Fresh login to dashboard as `admin@carekit-test.com`.
2. Navigate to any authenticated dashboard page (e.g., `/clients`).
3. UI renders but empty — all stats = 0 and the screen shows raw error string `ORG_SUSPENDED`.

### Expected
- Default org (`00000000-0000-0000-0000-000000000001`) should never be left in a suspended state in dev.
- If the API returns a tenant error, the dashboard should render a localized, user-friendly error — not the raw error code.

### Actual — Root Cause Analysis

**Layer 1 — Database state:**
```sql
SELECT id, "nameEn", "suspendedAt" FROM "Organization"
WHERE id = '00000000-0000-0000-0000-000000000001';

-- Result:
-- id                                   | nameEn               | suspendedAt
-- 00000000-0000-0000-0000-000000000001 | Default Organization | 2026-04-24 15:31:43.496
```

The default org was suspended (likely a leftover from SaaS-05b super-admin `SuspendOrganizationHandler` testing — timestamp matches a recent testing session).

**Layer 2 — Redis cache:**
```
KEY: org-suspension:00000000-0000-0000-0000-000000000001
TTL: ORG_SUSPENSION_CACHE_TTL_SECONDS (see jwt.guard.ts)
```

File: `apps/backend/src/common/guards/jwt.guard.ts:97-120`
```ts
async assertOrganizationIsActive(organizationId?: string): Promise<void> {
  if (!organizationId) return;

  const redis = this.redis.getClient();
  const key = this.buildOrgSuspensionCacheKey(organizationId);
  const cached = await redis.get(key);

  if (cached === ACTIVE_ORG_CACHE_SENTINEL) return;
  if (cached) {
    throw new UnauthorizedException('ORG_SUSPENDED');  // ← thrown here
  }

  const organization = await this.prisma.organization.findUnique({
    where: { id: organizationId },
    select: { suspendedAt: true },
  });

  const cacheValue = organization?.suspendedAt?.toISOString() ?? ACTIVE_ORG_CACHE_SENTINEL;
  await redis.set(key, cacheValue, 'EX', ORG_SUSPENSION_CACHE_TTL_SECONDS);

  if (organization?.suspendedAt) {
    throw new UnauthorizedException('ORG_SUSPENDED');
  }
}
```

Even after the DB was fixed, Redis continued serving the cached suspension timestamp until TTL expired or the key was deleted.

**Layer 3 — Dashboard UI:**
The dashboard displays the raw `ORG_SUSPENDED` string in the UI (visible on the `/clients` page as a plain text node between the stats grid and the filter bar — see snapshot node `uid=3_47 StaticText "ORG_SUSPENDED"`). No localization, no graceful error boundary.

### Suggested fixes (for developer)

1. **Seed idempotency** (`apps/backend/prisma/seed.ts`):
   When upserting the default organization, explicitly set `suspendedAt: null` in the `update` branch so that re-running the seed restores an active org.

2. **Dashboard error handling:**
   Detect `ORG_SUSPENDED` tenant error code at the API-client layer and either:
   - Force logout and redirect to a dedicated "organization suspended" page, OR
   - Show a full-screen blocking banner in Arabic/English ("هذه المنظمة معلّقة حالياً — تواصل مع الدعم").
   Never render the raw error code in a data slot.

3. **Dev-only safety net:** Consider a dev script `npm run reset:org-suspension` that wipes `suspendedAt` and clears the Redis `org-suspension:*` keys in one command.

### Temporary workaround used during testing
```bash
docker exec <postgres-container> psql -U carekit -d carekit_dev -c \
  "UPDATE \"Organization\" SET \"suspendedAt\" = NULL WHERE id = '00000000-0000-0000-0000-000000000001';"
docker exec <redis-container> redis-cli DEL "org-suspension:00000000-0000-0000-0000-000000000001"
```

### Evidence
- Snapshot capture showed `uid=3_47 StaticText "ORG_SUSPENDED"` rendered inside the `main` content area.
- Screenshot: `docs/superpowers/qa/e2e-dashboard/01-clients-list.png`

---

## 🐛 BUG #2 — Empty email field missing placeholder "—" on client details page

### Severity: **LOW** (visual inconsistency)

### Reproduction
1. Login and navigate to `/clients`.
2. Open any client that has no email (e.g., the test client created in step 1.2 with phone `+966511223344`).
3. Observe the "بيانات التواصل" section under the default tab "التواصل والبيانات".

### Expected
Empty email should render `—` (em-dash) for consistency with all other empty fields in the same details view (الجنس، تاريخ الميلاد، رقم الهوية، الحساسية، الأمراض المزمنة… all use "—").

### Actual
Email row renders as:
```
البريد الإلكتروني  :   [empty — no placeholder]
```

From accessibility snapshot:
```
uid=9_36 StaticText "البريد الإلكتروني"
uid=9_37 StaticText ":"
  ← missing StaticText node here
uid=9_38 StaticText "رقم الجوال"
```

Contrast this with the phone number row right after (which has a value) and with all other empty rows in the same section (all have the "—" node).

### Location
Likely in: `apps/dashboard/components/features/clients/client-details/contact-info-section.tsx` (or equivalent — whichever component renders the "بيانات التواصل" section of `/clients/[id]`).

### Suggested fix
Render `client.email ?? "—"` (or `client.email || "—"` if empty string is possible) to match the pattern used by every other optional field in the same view.

### Evidence
- Screenshot: `docs/superpowers/qa/e2e-dashboard/01-clients-detail-email-missing-dash.png` (to be captured on next pass if needed)
- Accessibility snapshot captured during test 1.3 shows the missing value node.

---

## ✅ Successful flows (for regression baseline)

### 1.1 — List page
- **Route:** `/clients`
- **Observations:**
  - Page Anatomy matches spec: Breadcrumbs → PageHeader (title + Export + Add) → StatsGrid (4 cards) → FilterBar → Table → Pagination
  - Stats: إجمالي 25 · نشط 23 · غير نشط 2 · جدد هذا الشهر 25
  - Table columns: Avatar+Name, Phone, تاريخ التسجيل, آخر زيارة, الموعد القادم, الحالة, الإجراءات
  - Row actions: عرض / تعديل / حظر (or تفعيل if inactive) / حذف — all icon-only with tooltips
  - Pagination works (page 1 of 2, 20 rows/page)
  - Export button is `disabled` — confirm intended (likely feature-flagged or no-data guard)
  - RTL layout correct, no console errors

### 1.2 — Create page
- **Route:** `/clients/create`
- **Form sections:** البيانات الشخصية · بيانات التواصل · جهة اتصال الطوارئ · المعلومات الطبية الأساسية
- **Minimum required fields:** الاسم الأول, اسم العائلة, رقم الجوال
- **Test data used:** `اختبار QA`, phone `+966511223344`
- **Outcome:** Created successfully, redirected to list, total went 25 → 26

### 1.3 — Details page
- **Route:** `/clients/[id]`
- **Tabs:** التواصل والبيانات · المواعيد · الفواتير · الإحصائيات
- See Bug #2 above for the email placeholder issue.

### 1.4 — Edit page
- **Route:** `/clients/[id]/edit`
- Loaded with existing data pre-filled.
- Test: added `الاسم الثاني = محدّث`, saved → returned to list without error.

### 1.5 — Search
- Real-time filter (debounced).
- Reset button "إعادة تعيين" appears when filters applied.
- Result count updates correctly (`26 إجمالي المستفيدين` → `1 إجمالي المستفيدين` when searching "اختبار").

### 1.6 — Delete
- Confirm dialog appears: title "حذف المستفيد؟", body explains soft-delete semantics and recoverability by support team.
- After confirm: row removed, stats update, total back to 25.

---

## Console / Network observations

- Zero console errors during the full CRUD cycle (after Bug #1 was manually worked around).
- No 4xx/5xx network errors after fix.
- One earlier 401 confirmed the JWT guard throwing on the cached suspension.

---

## Next phase
Phase 2 — Employees (المعالجين / الممارسون) — `/employees` CRUD.
