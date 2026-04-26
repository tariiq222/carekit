# Tenant Onboarding SOP — Manual Procedure

> **Owner:** Platform Operations · **Last updated:** 2026-04-26 · **Status:** Active until Plan 07 (self-serve signup) ships.

CareKit has **no self-serve tenant signup**. Every clinic is added by CareKit staff via either the super-admin app or a one-shot Prisma script. This document is the canonical procedure.

---

## 1 · Pre-flight inputs (collect from the clinic)

| Field | Format | Example | Required |
|-------|--------|---------|----------|
| Legal name (AR) | Arabic UTF-8 | `عيادة الأمل` | ✅ |
| Legal name (EN) | Latin | `Hope Clinic` | ✅ |
| Slug | `[a-z0-9-]{2,32}`, globally unique | `hope-clinic` | ✅ |
| Vertical slug | one of seeded `Vertical.slug` (e.g. `family-consulting`, `dental`, `physiotherapy`) | `dental` | ✅ |
| Plan slug | one of seeded `Plan.slug` (`BASIC`, `PRO`, `ENTERPRISE`) | `BASIC` | ✅ |
| Primary admin email | RFC-5322 valid, unique across all tenants | `owner@hope-clinic.example` | ✅ |
| Primary admin phone | E.164 (`+9665XXXXXXXX`) | `+966512345678` | ✅ |
| Default locale | `ar` or `en` | `ar` | ✅ |
| Timezone | IANA (`Asia/Riyadh` for KSA) | `Asia/Riyadh` | ✅ |
| Branding assets | Logo PNG/SVG ≤ 1 MB; primary HEX color | — | optional |
| Contract / billing reference | Internal ID (CRM, contract number) | `CK-2026-042` | optional |

Refuse onboarding until every required field is filled. Do **not** improvise — a clinic with the wrong vertical or plan triggers feature-gate misfires after the fact.

---

## 2 · Procedure A — Super-admin app (preferred when route ships)

> **Status as of 2026-04-26:** the create-organization page is **NOT yet implemented** in `apps/admin`. The list view + detail view + suspend/reinstate exist, but `/organizations/new` returns 404. Use Procedure B until the create form lands. This section is here for when it does.

When the create page is shipped:

1. Open `https://admin.carekit.app` (prod) or `http://localhost:5104` (dev).
2. Sign in as a super-admin (`SUPER_ADMIN_EMAIL` from `.env.prod`).
3. Navigate to **Organizations → New**.
4. Fill the form using the Section 1 inputs.
5. Submit. The backend writes:
   - `Organization` row (status = `active`, locked to vertical + plan)
   - `OrganizationSettings` singleton (timezone, locale)
   - `BrandingConfig` singleton (defaults from vertical template; override via `/branding` later)
   - `User` row for the primary admin (random password, mark `mustChangePassword=true`)
   - `Membership` linking that user to the org with role `OWNER`
   - `SuperAdminActionLog` entry (`action='create_organization'`, with the staff member's reason text)
6. Copy the temp password from the success toast. Send it to the clinic out-of-band (do NOT email plaintext).

---

## 3 · Procedure B — Prisma seed script (fallback, current path)

This is the supported path **today**.

### 3.1 — Generate the seed file

Save the following as `apps/backend/prisma/seeds/onboard-<slug>.ts` (one file per tenant). Replace the `INPUTS` block with the values from Section 1.

```ts
/**
 * Manual onboarding seed: <legal name EN>
 * Run: npx tsx apps/backend/prisma/seeds/onboard-<slug>.ts
 * Idempotent — safe to re-run.
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

// ── INPUTS ──────────────────────────────────────────────────────────────────
const SLUG = '<slug>';
const NAME_AR = '<legal name AR>';
const NAME_EN = '<legal name EN>';
const VERTICAL_SLUG = '<vertical-slug>';
const PLAN_SLUG = '<PLAN_SLUG>';
const ADMIN_EMAIL = '<owner@example.com>';
const ADMIN_PHONE = '+9665XXXXXXXX';
const ADMIN_NAME_EN = '<Owner Name>';
const LOCALE = 'ar' as const;
const TIMEZONE = 'Asia/Riyadh';
const TEMP_PASSWORD = '<generate via openssl rand -base64 24>';
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  await prisma.$connect();

  const vertical = await prisma.vertical.findUniqueOrThrow({ where: { slug: VERTICAL_SLUG } });
  const plan = await prisma.plan.findUniqueOrThrow({ where: { slug: PLAN_SLUG } });

  const orgId = randomUUID();
  const passwordHash = await hash(TEMP_PASSWORD, 12);

  const userId = await prisma.$transaction(async (tx) => {
    await tx.organization.upsert({
      where: { slug: SLUG },
      update: {},
      create: {
        id: orgId, slug: SLUG, nameAr: NAME_AR, nameEn: NAME_EN,
        verticalId: vertical.id, status: 'active',
      },
    });
    await tx.organizationSettings.upsert({
      where: { organizationId: orgId },
      update: {},
      create: { organizationId: orgId, defaultLocale: LOCALE, timezone: TIMEZONE },
    });
    await tx.brandingConfig.upsert({
      where: { organizationId: orgId },
      update: {},
      create: { organizationId: orgId },
    });
    // Use the upsert-returned id so we never assume the email is new — if the
    // owner already has an account (multi-tenant), Membership links to it.
    const user = await tx.user.upsert({
      where: { email: ADMIN_EMAIL },
      update: {},
      create: {
        id: randomUUID(), email: ADMIN_EMAIL, phone: ADMIN_PHONE,
        firstName: ADMIN_NAME_EN.split(' ')[0], lastName: ADMIN_NAME_EN.split(' ').slice(1).join(' ') || '-',
        passwordHash, mustChangePassword: true, isActive: true,
      },
    });
    await tx.membership.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
      update: {},
      create: { userId: user.id, organizationId: orgId, role: 'OWNER' },
    });
    await tx.subscription.create({
      data: { organizationId: orgId, planId: plan.id, status: 'TRIAL' },
    });
    return user.id;
  });

  console.log(`✓ Onboarded ${SLUG} → org ${orgId}, user ${userId}, temp pw above`);
  await prisma.$disconnect();
}
main();
```

### 3.2 — Run

```bash
cd apps/backend
npx tsx prisma/seeds/onboard-<slug>.ts
```

### 3.3 — Verify rows

```bash
docker exec -it carekit-postgres psql -U carekit -d carekit_prod -c \
  "SELECT id, slug, name_en, status FROM \"Organization\" WHERE slug='<slug>';"
docker exec -it carekit-postgres psql -U carekit -d carekit_prod -c \
  "SELECT u.email, m.role FROM \"User\" u JOIN \"Membership\" m ON m.user_id=u.id JOIN \"Organization\" o ON o.id=m.organization_id WHERE o.slug='<slug>';"
```

---

## 4 · Hand-off to the clinic owner (first-login walkthrough)

Send the clinic admin **out-of-band** (signed PDF, secure messenger):

1. **Login URL** — `https://app.carekit.app` (prod) or per-deployment domain.
2. **Email** — the address from Section 1.
3. **Temporary password** — generated above. Tell them: must be rotated on first login.
4. Walkthrough script for the call:
   - Login → forced password rotation → choose strong password (min 8, 1 upper, 1 digit).
   - **Settings → Branding** → upload logo + set primary color. Per-tenant theme tokens flow from here.
   - **Settings → Business hours** → days + hours.
   - **Services** → add their service catalogue.
   - **Employees** → invite at least one practitioner.
   - **Settings → Payments** → enter their tenant Moyasar `sk_*` keys (separate from CareKit's platform Moyasar).
   - **Settings → SMS** → choose Unifonic or Taqnyat and enter their own credentials (we don't bill SMS — they pay the provider).
   - **Settings → Integrations → Zoom** → optional, only if they need video calls.

---

## 5 · Verification checklist (run with the clinic owner on the call)

| Check | How | Pass when |
|-------|-----|-----------|
| Login works | Open `app.carekit.app`, sign in | Dashboard loads, branding is theirs |
| Booking flow | Mobile app → book any service → pay (test card) | Booking row + Invoice row + Payment row created in DB |
| Payment flow | Use Moyasar test card `4111 1111 1111 1111` | `Invoice.status=PAID` within 5s of redirect |
| OTP delivery | Mobile login with their phone | Authentica SMS arrives within 30s |
| Tenant SMS | Trigger booking confirmation | Unifonic/Taqnyat DLR webhook flips status to delivered |
| Cross-tenant isolation | Log in as another tenant, query `/dashboard/clients` | Returns only the new tenant's rows |

If any check fails, **STOP** and rollback (Section 6) before letting the clinic onboard real clients.

---

## 6 · Rollback (if onboarding fails or contract is cancelled)

Never `DELETE` rows directly. Use the soft-delete + audit-log pattern:

```sql
BEGIN;
UPDATE "Organization" SET status='archived', deleted_at=NOW() WHERE slug='<slug>';
UPDATE "Membership"   SET deleted_at=NOW() WHERE organization_id=(SELECT id FROM "Organization" WHERE slug='<slug>');
UPDATE "User"         SET is_active=false  WHERE id IN (SELECT user_id FROM "Membership" WHERE organization_id=(SELECT id FROM "Organization" WHERE slug='<slug>'));
INSERT INTO "SuperAdminActionLog" (id, super_admin_id, action, target_type, target_id, reason, created_at)
  VALUES (gen_random_uuid(), '<super-admin-user-id>', 'archive_organization', 'Organization',
          (SELECT id FROM "Organization" WHERE slug='<slug>'),
          '<10+ char reason>', NOW());
COMMIT;
```

If MinIO bucket cleanup is needed:

```bash
docker exec -it carekit-minio mc rm --recursive --force local/carekit/orgs/<slug>/
```

---

## 7 · Known gaps (deferred to Plan 07)

- **Self-serve signup wizard** — clinic fills the form themselves, payment captured up-front. Tracked under `docs/superpowers/plans/2026-04-21-saas-07-public-website-and-onboarding.md` (deferred per the 2026-04-22 strategy revision; reactivate when mass-acquisition becomes a priority).
- **Admin create-organization page** — currently the super-admin app shows the org list + detail but no create form. Add `apps/admin/app/(admin)/organizations/new/page.tsx` + `features/organizations/create-organization/` slice when Procedure A becomes the default.
- **Automated welcome email** — temp password delivery is currently manual. Add an email template (`org-welcome.html`) + trigger on `Organization.created` event.
- **Kiwi TCMS test plan** — capture this SOP as a manual-QA plan under `data/kiwi/onboarding-<date>.json` once we have ≥ 3 onboarded tenants.
