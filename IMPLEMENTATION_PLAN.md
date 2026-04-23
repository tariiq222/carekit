# IMPLEMENTATION PLAN — SaaS-06b/c/d: P0 Tenant Settings

**Date:** 2026-04-23  
**Scope:** Three P0 features — Organization Profile, Members Management, Payment Methods  
**Path:** STANDARD (no worktree required)  
**PRs:** 3 sequential PRs — each mergeable independently  
**Owner-only gate:** PR3 only (payments module — Abdullah review mandatory)

---

## Context

The dashboard has no page for a clinic to edit its own identity, manage its staff members, or manage its saved payment card. All three are blocking for any clinic that has just subscribed.

**What already exists (do NOT rebuild):**
- `POST /dashboard/organization/branding/logo` → logo upload (MinIO), works
- `BrandingConfig` singleton with `logoUrl`, `organizationNameAr/En`, `productTagline`
- `Organization` model with `nameAr`, `nameEn`, `slug` in `platform.prisma`
- `Membership` model with `userId`, `organizationId`, `role`, `isActive` in `platform.prisma`
- `Subscription.moyasarCardTokenRef` (String?) already in `platform.prisma`
- `MoyasarApiClient` in `src/modules/finance/moyasar-api/moyasar-api.client.ts`
- User management handlers in `src/modules/identity/users/`
- File upload: `POST /dashboard/media/upload` (multipart, 25 MB max, MinIO-backed)

---

## PR1 — SaaS-06b: Organization Profile Page

**Branch:** `feat/saas-06b-org-profile`  
**Touches:** org-experience cluster (backend) + settings/organization (dashboard)  
**Prisma migration:** NO — all fields exist  
**Owner-only:** NO

### What it does
New page `/settings/organization` — clinic owner edits:
- Organization name (AR + EN)
- Slug (uniqueness check; caution note re Plan 09 subdomain lock)
- Tagline / description (`BrandingConfig.productTagline`)
- Logo (delegates to existing `POST /dashboard/organization/branding/logo`)

### Backend — 2 new slices in `org-experience/` cluster

**Slice A: `get-org-profile`**  
File: `src/modules/org-experience/get-org-profile/get-org-profile.handler.ts`  
Reads `Organization` (nameAr, nameEn, slug) + `BrandingConfig` (productTagline, logoUrl).  
Returns merged `OrgProfileDto { nameAr, nameEn, slug, tagline, logoUrl }`.  
Unit test: `get-org-profile.handler.spec.ts`

**Slice B: `update-org-profile`**  
File: `src/modules/org-experience/update-org-profile/update-org-profile.handler.ts`  
Validates slug uniqueness (exclude self). Updates `Organization` + syncs `BrandingConfig.organizationNameAr/En` + stores `productTagline` in one `$transaction`.  
Slug conflict → `ConflictException('SLUG_TAKEN')`.  
Input DTO: `nameAr?`, `nameEn?`, `slug?` (lowercase alphanum-hyphen, max 40), `tagline?` (max 300).  
Unit test: `update-org-profile.handler.spec.ts`

**Controller wiring** — extend `src/api/dashboard/organization-settings.controller.ts`:
```
GET   /dashboard/organization/profile  → GetOrgProfileHandler
PATCH /dashboard/organization/profile  → UpdateOrgProfileHandler (OWNER | ADMIN, CASL)
```

### Dashboard — 4 new files

1. `apps/dashboard/lib/api/organization-profile.ts` (≤80 lines) — `fetchOrgProfile()`, `updateOrgProfile()`
2. `apps/dashboard/hooks/use-organization-profile.ts` (≤80 lines) — query (staleTime 10 min) + mutation
3. `apps/dashboard/components/features/settings/organization-profile-form.tsx` (≤300 lines)  
   RHF + Zod. Logo section → file input → `POST /dashboard/media/upload` → logo endpoint.  
   Slug: debounced (500 ms) uniqueness feedback. Caution banner on slug change.
4. `apps/dashboard/app/(dashboard)/settings/organization/page.tsx` (≤60 lines)  
   Breadcrumb → PageHeader → `<OrganizationProfileForm />`

**Sidebar:** add to Admin group in `sidebar-config.ts`:  
`{ label: "settings.organization.title", href: "/settings/organization", icon: Building07Icon }`

### i18n keys (AR + EN — run `npm run i18n:verify`)

| Key | AR | EN |
|-----|----|----|
| `settings.organization.title` | ملف العيادة | Organization Profile |
| `settings.organization.description` | اسم العيادة والمعرّف والشعار | Clinic name, slug, and logo |
| `settings.organization.nameAr` | الاسم بالعربي | Name (Arabic) |
| `settings.organization.nameEn` | الاسم بالإنجليزي | Name (English) |
| `settings.organization.slug` | المعرّف | Slug |
| `settings.organization.slugHint` | أحرف صغيرة وأرقام وشرطة فقط | Lowercase, numbers, hyphens only |
| `settings.organization.slugTaken` | هذا المعرّف مستخدم | This slug is already taken |
| `settings.organization.slugCaution` | تغيير المعرّف قد يؤثر على النطاق الفرعي لاحقاً | Changing the slug may affect subdomain routing later |
| `settings.organization.tagline` | الوصف | Description / Tagline |
| `settings.organization.logo` | الشعار | Logo |
| `settings.organization.logoUpload` | رفع شعار جديد | Upload New Logo |
| `settings.organization.saved` | تم حفظ الملف | Profile saved |

---

## PR2 — SaaS-06c: Members Management Page

**Branch:** `feat/saas-06c-members`  
**Touches:** identity cluster (backend) + settings/members (dashboard) + platform.prisma migration  
**Prisma migration:** YES — `Invitation` model in `platform.prisma`  
**Owner-only:** NO (CASL: OWNER | ADMIN for invite/remove)

### ADR — Invitation Model
File: `docs/decisions/2026-04-23-invitation-model.md`  
**Decision:** `Invitation` table in `platform.prisma` (co-located with `Membership`).  
**Reason:** State machine (PENDING → ACCEPTED | REVOKED | EXPIRED) requires persistence. Not tenant-scoped via CLS (same as `Membership`). Queried by token (public) or orgId (dashboard).  
**Rollback:** Drop `Invitation` table — no FK to existing tables.

### Prisma migration
Name: `20260423_saas_06c_invitation`  
Append to `platform.prisma` (after Membership block):

```prisma
enum InvitationStatus { PENDING ACCEPTED REVOKED EXPIRED }

model Invitation {
  id              String           @id @default(uuid())
  organizationId  String
  email           String
  role            MembershipRole
  token           String           @unique   // signed JWT, 72h TTL
  status          InvitationStatus @default(PENDING)
  expiresAt       DateTime
  invitedByUserId String
  acceptedAt      DateTime?
  revokedAt       DateTime?
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  @@index([organizationId])
  @@index([token])
  @@index([email, organizationId])
  @@index([status, expiresAt])
}
```

### Backend — 6 new slices in `identity/` cluster

| Slice | Endpoint | Notes |
|-------|----------|-------|
| `list-members` | `GET /dashboard/organization/members` | Joins User (name, email, avatarUrl). Filters: role, isActive |
| `update-member-role` | `PATCH /dashboard/organization/members/:id/role` | Cannot change sole OWNER |
| `deactivate-member` | `PATCH /dashboard/organization/members/:id/deactivate` | Cannot deactivate self or sole OWNER |
| `invite-member` | `POST /dashboard/organization/members/invite` | Body: `{email, role}`. Creates Invitation + sends email |
| `list-invitations` | `GET /dashboard/organization/members/invitations` | Returns PENDING + EXPIRED for current org |
| `revoke-invitation` | `DELETE /dashboard/organization/members/invitations/:id` | Sets REVOKED |

**invite-member flow:**
1. Existing Membership for (email, orgId) → `ConflictException('ALREADY_MEMBER')`
2. Revoke any PENDING invitation for same email+org
3. Create `Invitation` (token = JWT signed with `INVITE_SECRET`, 72h)
4. Send email via `MailService`: link `{DASHBOARD_URL}/accept-invitation?token=...`

**Public accept endpoint** — extend `src/api/public/auth.controller.ts`:  
`POST /api/v1/public/auth/accept-invitation` — body: `{ token, password? }`  
Flow: verify JWT → load Invitation (PENDING, not expired) → find or create User → create Membership → set ACCEPTED → return `{ accessToken, refreshToken }` (auto-login).

**Controller wiring** — extend `src/api/dashboard/identity.controller.ts`.  
All endpoints: CASL `manage:Membership` (OWNER | ADMIN).

### Dashboard — 6 new files

1. `apps/dashboard/lib/api/members.ts` (≤150 lines)
2. `apps/dashboard/hooks/use-members.ts` (≤100 lines) — query + staleTime 30s
3. `apps/dashboard/hooks/use-member-mutations.ts` (≤120 lines) — invite, deactivate, role change, revoke
4. `apps/dashboard/components/features/settings/members-table.tsx` (≤300 lines)  
   Columns: Avatar+Name | Email | Role badge | Status | Joined | Actions
5. `apps/dashboard/components/features/settings/invite-member-dialog.tsx` (≤200 lines)  
   Email + role selector → pending invitations list below
6. `apps/dashboard/app/(dashboard)/settings/members/page.tsx` (≤80 lines)  
   Page Anatomy: PageHeader (+ Invite button) | StatsGrid (4 cards) | FilterBar | DataTable | Dialogs

**Sidebar:** add to Admin group: `{ href: "/settings/members", icon: UserGroup02Icon }`

### i18n keys

| Key | AR | EN |
|-----|----|----|
| `members.title` | أعضاء الفريق | Team Members |
| `members.invite` | دعوة عضو | Invite Member |
| `members.invite.sent` | تم إرسال الدعوة | Invitation sent |
| `members.invite.alreadyMember` | هذا المستخدم عضو بالفعل | Already a member |
| `members.role.OWNER` | مالك | Owner |
| `members.role.ADMIN` | مدير | Admin |
| `members.role.RECEPTIONIST` | موظف استقبال | Receptionist |
| `members.role.ACCOUNTANT` | محاسب | Accountant |
| `members.role.EMPLOYEE` | موظف | Employee |
| `members.deactivate.confirm` | هل تريد تعطيل هذا العضو؟ | Deactivate this member? |
| `members.invitations.pending` | دعوات معلّقة | Pending Invitations |
| `members.invitations.revoke` | إلغاء الدعوة | Revoke |
| `members.invitations.expired` | منتهية | Expired |
| `members.stats.total` | إجمالي الأعضاء | Total Members |
| `members.stats.active` | نشط | Active |
| `members.stats.pending` | دعوات معلّقة | Pending Invites |
| `members.stats.owners` | ملاك | Owners |

### Tenant isolation test
File: `apps/backend/test/tenant-isolation/members.e2e-spec.ts`  
Verify: Org A cannot list/invite/deactivate members of Org B. Cross-org FK injection on membershipId → 404.

---

## PR3 — SaaS-06d: Payment Methods

**Branch:** `feat/saas-06d-payment-methods`  
**Touches:** finance cluster (backend) + billing settings (dashboard) + platform.prisma migration  
**Prisma migration:** YES — 4 nullable columns on `Subscription`  
**Owner-only:** YES — **Abdullah review mandatory**

### ADR — Card Metadata on Subscription
File: `docs/decisions/2026-04-23-saved-card-on-subscription.md`  
**Decision:** 4 nullable columns on `Subscription` (last4, brand, expiryMonth, expiryYear). No separate model.  
**Reason:** One sub per org (`@unique(organizationId)`). Multi-card not in scope for Phase 1.  
**Future:** Extract to `SavedPaymentMethod` model if multi-card needed.  
**Rollback:** Drop 4 nullable columns — safe, no data loss.

### Prisma migration
Name: `20260423_saas_06d_subscription_card_meta`  
Add to `Subscription` in `platform.prisma`:
```prisma
  cardLast4        String?
  cardBrand        String?  // "VISA" | "MADA" | "MASTERCARD"
  cardExpiryMonth  Int?
  cardExpiryYear   Int?
```

### Backend — 3 new slices in `finance/` cluster

**Slice 1: `save-payment-method`**  
`POST /dashboard/billing/payment-methods` — body: `{ moyasarToken: string }`  
Flow:
1. Load Subscription for current org
2. If `moyasarCustomerRef` null → `MoyasarApiClient.createCustomer()` → store ref
3. `MoyasarApiClient.saveCard(customerRef, moyasarToken)` → `{ id, last_four, brand, expiry_month, expiry_year }`
4. Update Subscription (cardTokenRef + 4 meta fields)

Moyasar `invalid_card` → `UnprocessableEntityException('INVALID_CARD')`.

**Slice 2: `get-payment-method`**  
`GET /dashboard/billing/payment-methods`  
Returns `{ hasCard, last4, brand, expiryMonth, expiryYear }` — never exposes raw token.

**Slice 3: `remove-payment-method`**  
`DELETE /dashboard/billing/payment-methods`  
Guard: if renewal within 7 days and status ACTIVE → `ConflictException('CARD_NEEDED_FOR_RENEWAL')`.  
Flow: call `MoyasarApiClient.deleteCard()` (best-effort) → null out all 5 card fields on Subscription.

**MoyasarApiClient** — extend `moyasar-api.client.ts`:  
Add `createCustomer()`, `saveCard()`, `deleteCard()` methods.  
Use `moyasar` skill for API reference.

**Controller wiring** — extend `src/api/dashboard/billing.controller.ts`:
```
GET    /dashboard/billing/payment-methods  → GetPaymentMethodHandler
POST   /dashboard/billing/payment-methods  → SavePaymentMethodHandler   (OWNER only)
DELETE /dashboard/billing/payment-methods  → RemovePaymentMethodHandler (OWNER only)
```

### Dashboard — 3 new files + 1 modified

1. `apps/dashboard/lib/api/payment-methods.ts` (≤80 lines)
2. `apps/dashboard/hooks/use-payment-method.ts` (≤100 lines) — query + save + remove mutations
3. `apps/dashboard/components/features/settings/payment-method-card.tsx` (≤250 lines)  
   States: no-card | has-card (chip: brand icon + ●●●● last4 + MM/YY + Change/Remove) | adding (Moyasar.js iframe)  
   Use `moyasar` skill for iframe embed details.
4. `apps/dashboard/app/(dashboard)/settings/billing/page.tsx` — insert `<PaymentMethodCard />` between CurrentPlanCard and UsageBars

### i18n keys

| Key | AR | EN |
|-----|----|----|
| `billing.paymentMethod.title` | طريقة الدفع | Payment Method |
| `billing.paymentMethod.noCard` | لا توجد بطاقة محفوظة | No saved card |
| `billing.paymentMethod.add` | إضافة بطاقة | Add Card |
| `billing.paymentMethod.change` | تغيير البطاقة | Change Card |
| `billing.paymentMethod.remove` | حذف البطاقة | Remove Card |
| `billing.paymentMethod.remove.confirm` | هل تريد حذف البطاقة؟ | Remove this card? |
| `billing.paymentMethod.cardNeededForRenewal` | لا يمكن الحذف قبل التجديد القادم | Cannot remove before upcoming renewal |
| `billing.paymentMethod.invalidCard` | بيانات البطاقة غير صحيحة | Invalid card details |
| `billing.paymentMethod.saved` | تم حفظ البطاقة | Card saved |
| `billing.paymentMethod.removed` | تم حذف البطاقة | Card removed |

---

## Execution Order

```
PR1 (SaaS-06b) ──┐
                  ├── can be worked in parallel, merge PR1 first
PR2 (SaaS-06c) ──┘
PR3 (SaaS-06d) — after PR1+PR2 merged (touches billing page modified by PR1 indirectly)
```

---

## File Budget per PR

| PR | New Backend Files | New Dashboard Files | Migration |
|----|------------------|---------------------|-----------|
| PR1 | 5 (2 handlers + 2 specs + controller ext.) | 4 | ❌ |
| PR2 | 14 (6 handlers + 6 specs + 1 isolation test + controller ext.) | 6 | ✅ platform.prisma |
| PR3 | 8 (3 handlers + 3 specs + client ext. + controller ext.) | 3 + 1 modified | ✅ platform.prisma |

All files ≤350 lines. Each PR: 2 commits (backend + dashboard).

---

## Pre-PR Checklist (every PR)

```
□ npm run typecheck          → 0 errors
□ npm run lint               → 0 new errors
□ cd apps/backend && npm run test  → all pass
□ npm run i18n:verify        → AR/EN parity
□ npm run prisma:migrate     → applies cleanly (PR2, PR3)
□ No file > 350 lines
□ No hex colors, no text-gray-*
□ RTL logical spacing (ps-/pe-/ms-/me-)
□ Icons from @hugeicons only
□ staleTime set on every new query
□ Tenant isolation test added (PR2 only)
□ Manual QA via Chrome DevTools MCP before merge
□ Abdullah review on PR3 (owner-only: payments)
□ openapi:build-and-snapshot after each backend PR
```

## Kiwi TestPlans

| PR | Kiwi Plan |
|----|-----------|
| PR1 | `CareKit / Organization / Manual QA` |
| PR2 | `CareKit / Members / Manual QA` |
| PR3 | `CareKit / Billing / Manual QA` |
