# Plan G — Finalization (Seed + Docs + E2E Verification)

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`. Steps use `- [ ]` checkboxes.

**Goal:** Rewrite the dev seed for single-organization bootstrap (admin + singletons + main branch), update all four CLAUDE.md files to reflect single-org architecture, run the full end-to-end verification suite (typecheck, lint, test, build on every app), and execute Chrome DevTools MCP QA walkthrough to capture screenshots as pre-merge evidence.

**Architecture:** No new code, only seed refactor + doc updates + verification. This is the gate that proves the system works end-to-end.

**Tech Stack:** Prisma seed · Markdown · Chrome DevTools MCP.

---

## ⚠️ Prerequisites — session rules

**Before you start this plan:**
- ALL of Plans A, B, C, D, E, F must be COMPLETE and merged to `feat/single-organization-mode`. Verify:
  ```bash
  cd c:\pro\carekit
  # Zero tenant references anywhere in source/tests/schemas
  grep -rn "tenantId\|@TenantId\|X-Tenant-ID\|NEXT_PUBLIC_TENANT_ID" apps/ packages/ --include="*.ts" --include="*.tsx" --include="*.prisma" --include="*.md" 2>&1 | grep -v node_modules | grep -v ".next" | grep -v "docs/superpowers"
  # Must return ZERO meaningful matches (docs/plans may mention the word in historical context — that's OK)

  # Tenant folder gone
  ls apps/backend/src/common/tenant/ 2>&1
  # Must say "No such file or directory"

  # License folder gone
  ls apps/backend/src/modules/platform/license/ 2>&1
  # Must say "No such file or directory"

  # One initial migration exists
  ls apps/backend/prisma/migrations/
  # Must show one folder + migration_lock.toml

  # All apps build
  npm run build
  # Must succeed
  ```
- If any check fails, STOP. Do not skip prerequisite plans.

**Parallel execution rule:**
- **Plan G MUST run alone.** It is the final verification — no other plan should be modifying anything.

**Completion contract:**
- Plan G is DONE only when:
  1. `seed.ts` creates admin + 4 singleton rows + main branch with no tenant logic.
  2. Four CLAUDE.md files (root + 3 apps) have no `tenantId` / `@TenantId` / `X-Tenant-ID` references.
  3. Backend: `npm run lint && npm run build && npm run test && npm run test:e2e` all pass.
  4. Dashboard: `npm run typecheck && npm run lint && npm run test && npm run build` all pass.
  5. Mobile: `npx tsc --noEmit` passes.
  6. Full monorepo `npm run build` passes.
  7. Final grep returns ZERO tenant references across `apps/` and `packages/`.
  8. Chrome DevTools MCP walkthrough captured for 12 pages under `docs/audits/single-organization-mode/`.
  9. Branch pushed; optional: draft PR opened.

---

## File Structure

### Files modified
- `apps/backend/prisma/seed.ts` (complete rewrite)
- `CLAUDE.md` (root)
- `apps/backend/CLAUDE.md`
- `apps/dashboard/CLAUDE.md`
- `apps/mobile/CLAUDE.md` (if mentions tenant)

### Files created
- `docs/audits/single-organization-mode/*.png` (screenshots from Chrome DevTools MCP)
- `docs/audits/single-organization-mode/README.md` (index of screenshots)

### Files NOT touched
- Anything already finalized in Plans A-F

---

## Task G1 — Rewrite seed.ts

**Files:**
- `apps/backend/prisma/seed.ts`

- [ ] **Step 1: Replace seed.ts contents entirely**

Write this exact content:

```typescript
/**
 * Dev seed — creates an ADMIN user + singleton configs + main branch.
 * Run:  npm run prisma:seed
 * Safe to re-run: uses upsert everywhere.
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const ADMIN_EMAIL    = process.env.SEED_EMAIL    ?? 'admin@carekit-test.com';
const ADMIN_PASSWORD = process.env.SEED_PASSWORD ?? 'Admin@1234';

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  await prisma.$connect();

  // 1. Admin user (email is globally @unique now)
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      name: 'Admin',
      role: 'ADMIN',
      isActive: true,
    },
    update: {},
  });

  // 2. Branding singleton
  await prisma.brandingConfig.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      clinicNameAr: 'منظمتي',
      clinicNameEn: 'My Organization',
      primaryColor: '#354FD8',
      accentColor:  '#82CC17',
    },
    update: {},
  });

  // 3. Organization settings singleton
  await prisma.organizationSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default' },
    update: {},
  });

  // 4. Main branch
  await prisma.branch.upsert({
    where: { id: 'main-branch' },
    create: {
      id:       'main-branch',
      nameAr:   'الفرع الرئيسي',
      nameEn:   'Main Branch',
      isActive: true,
      isMain:   true,
      timezone: 'Asia/Riyadh',
      country:  'SA',
    },
    update: {},
  });

  await prisma.$disconnect();

  console.log('─────────────────────────────────────────────');
  console.log(`✔  Admin  : ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`✔  Branding singleton ready`);
  console.log(`✔  OrganizationSettings singleton ready`);
  console.log(`✔  Main branch created`);
  console.log('─────────────────────────────────────────────');
}

main().catch((e) => { console.error(e); process.exit(1); });
```

**Note:** If `OrganizationSettings` has non-nullable fields without `@default`, the `create` object needs sensible defaults for those. Read `organization.prisma` → `model OrganizationSettings` first to confirm, and add fields accordingly.

- [ ] **Step 2: Run seed against fresh DB**

```bash
cd c:\pro\carekit/apps/backend
npx prisma migrate reset --force
npm run prisma:seed
```

Expected: all four ✔ lines print. No errors.

- [ ] **Step 3: Verify in Prisma Studio**

```bash
npx prisma studio &
# Open http://localhost:5555
# Confirm: User has admin row; BrandingConfig has id='default'; OrganizationSettings has id='default'; Branch has main-branch row.
```

Close Studio when done.

- [ ] **Step 4: Commit**

```bash
cd c:\pro\carekit
git add apps/backend/prisma/seed.ts
git commit -m "refactor(seed): single-organization bootstrap — admin + singletons + main branch"
```

---

## Task G2 — Update CLAUDE.md files

**Files:**
- `CLAUDE.md` (root)
- `apps/backend/CLAUDE.md`
- `apps/dashboard/CLAUDE.md`
- `apps/mobile/CLAUDE.md` (if exists and mentions tenant)

- [ ] **Step 1: Read root CLAUDE.md**

Apply these edits:

- Description line: "White-label Clinic Management Platform" → "White-label Organization Management Platform" (keep phrasing natural).
- If Golden Rules mention tenant isolation, delete that rule.
- Anywhere the word "clinic" appears as the business concept (not as a code field like `clinicNameAr`), consider switching to "organization" where natural. Arabic "العيادة" → "المنظمة" where user-facing.
- Delete any sentence mentioning `tenantId`, `@TenantId`, or `X-Tenant-ID`.

- [ ] **Step 2: Edit apps/backend/CLAUDE.md**

- DELETE the rule: "Tenant isolation is mandatory. Every query scopes by `tenantId` extracted via `@TenantId()` ([common/tenant](src/common/tenant/)). A handler missing it is a bug."
- REPLACE with: "System is single-organization. Queries that span physical locations use `branchId` from the request body or authenticated user. There is no tenant layer — one deployment serves one organization."
- Remove any code snippet using `@TenantId()`.
- Remove any reference to `src/common/tenant/` folder.
- Anywhere `tenantId` appears in an example, rewrite without it.

- [ ] **Step 3: Edit apps/dashboard/CLAUDE.md**

Scan for `TENANT_ID`, `X-Tenant-ID`, or tenant concepts. Delete / reword.

- [ ] **Step 4: Edit apps/mobile/CLAUDE.md**

Same scan. Delete / reword.

- [ ] **Step 5: Verify no tenant mentions in CLAUDE.md files**

```bash
cd c:\pro\carekit
grep -in "tenant\|X-Tenant-ID" CLAUDE.md apps/backend/CLAUDE.md apps/dashboard/CLAUDE.md apps/mobile/CLAUDE.md 2>/dev/null
```

Expected: zero meaningful matches. Historical mentions in comment-like prose are acceptable only if they clarify the DELETED state (e.g., "there is no tenant layer").

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md apps/backend/CLAUDE.md apps/dashboard/CLAUDE.md apps/mobile/CLAUDE.md
git commit -m "docs: update CLAUDE.md files for single-organization model"
```

---

## Task G3 — Full backend verification

- [ ] **Step 1: Lint**

```bash
cd c:\pro\carekit/apps/backend
npm run lint
```

Expected: 0 errors.

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: success.

- [ ] **Step 3: Unit tests**

```bash
npm run test
```

Expected: all pass.

- [ ] **Step 4: E2E tests**

```bash
npm run test:e2e
```

Expected: all pass.

- [ ] **Step 5: If any fail, fix root cause and commit**

```bash
# After fixing
git add <changed files>
git commit -m "fix(<scope>): <root cause>"
```

Otherwise skip.

---

## Task G4 — Full dashboard verification

- [ ] **Step 1: Typecheck**

```bash
cd c:\pro\carekit/apps/dashboard
npm run typecheck
```

- [ ] **Step 2: Lint**

```bash
npm run lint
```

- [ ] **Step 3: Unit tests**

```bash
npm run test
```

- [ ] **Step 4: Build**

```bash
npm run build
```

Expected: all four pass.

---

## Task G5 — Full mobile verification

- [ ] **Step 1: Typecheck**

```bash
cd c:\pro\carekit/apps/mobile
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: If mobile has a test script**

```bash
npm run test 2>&1 | tail -10
```

Otherwise skip.

---

## Task G6 — Monorepo build

- [ ] **Step 1: Full build**

```bash
cd c:\pro\carekit
npm run build
```

Expected: all packages + apps build cleanly.

---

## Task G7 — Final tenant grep (the gate)

- [ ] **Step 1: Run the gate query**

```bash
cd c:\pro\carekit
grep -rin "tenantId\|@TenantId\|X-Tenant-ID\|NEXT_PUBLIC_TENANT_ID" apps/ packages/ --include="*.ts" --include="*.tsx" --include="*.prisma" --include="*.md" 2>&1 | grep -vE "node_modules|\.next/|dist/"
```

Expected: ZERO matches (ignore `docs/superpowers/plans/` which contain historical context).

If any appear, fix in-place and add a cleanup commit.

---

## Task G8 — Chrome DevTools MCP QA walkthrough

This is the REQUIRED pre-merge gate per `~/.claude/projects/c--pro-carekit/memory/chrome_devtools_mcp_qa_gate.md`.

**Files:**
- Create: `docs/audits/single-organization-mode/README.md`
- Create: `docs/audits/single-organization-mode/<page>.png` for each page

- [ ] **Step 1: Start backend**

```bash
cd c:\pro\carekit/apps/backend
npm run dev
```

Wait until: `Nest application successfully started` on port 5100.

- [ ] **Step 2: Start dashboard (separate terminal)**

```bash
cd c:\pro\carekit/apps/dashboard
npm run dev
```

Wait until: Next.js ready on port 5103.

- [ ] **Step 3: Open browser via Chrome DevTools MCP**

Navigate to: `http://localhost:5103/login`

Verify in Network tab: NO `X-Tenant-ID` header on any request.

Screenshot → `docs/audits/single-organization-mode/01-login.png`.

- [ ] **Step 4: Log in**

Email: `admin@carekit-test.com`, Password: `Admin@1234`.

Expected: redirect to dashboard home.

- [ ] **Step 5: Walk through 12 pages**

For each, verify: page renders, no 4xx/5xx in Network, no console errors, NO `X-Tenant-ID` header in any request. Capture screenshot named per list below.

| # | Path | Screenshot |
|---|---|---|
| 01 | `/login` | `01-login.png` |
| 02 | `/` (home after login) | `02-home.png` |
| 03 | `/bookings` | `03-bookings.png` |
| 04 | `/clients` | `04-clients.png` |
| 05 | `/employees` | `05-employees.png` |
| 06 | `/branches` | `06-branches.png` |
| 07 | `/departments` | `07-departments.png` |
| 08 | `/services` | `08-services.png` |
| 09 | `/branding` | `09-branding.png` |
| 10 | `/settings` | `10-settings.png` |
| 11 | `/invoices` | `11-invoices.png` |
| 12 | `/payments` | `12-payments.png` |
| 13 | `/reports` | `13-reports.png` |

- [ ] **Step 6: Write docs/audits/single-organization-mode/README.md**

```markdown
# Single-Organization Mode — QA Walkthrough

**Date:** <YYYY-MM-DD>
**Branch:** feat/single-organization-mode
**Verifier:** <name>

Dashboard walkthrough captured via Chrome DevTools MCP. All pages loaded cleanly, no `X-Tenant-ID` headers, no 4xx/5xx, no console errors.

## Pages

01. login — `01-login.png`
02. home — `02-home.png`
03. bookings — `03-bookings.png`
04. clients — `04-clients.png`
05. employees — `05-employees.png`
06. branches — `06-branches.png`
07. departments — `07-departments.png`
08. services — `08-services.png`
09. branding — `09-branding.png`
10. settings — `10-settings.png`
11. invoices — `11-invoices.png`
12. payments — `12-payments.png`
13. reports — `13-reports.png`

## Notes

- Seed created one admin user, 2 singleton configs (branding + org-settings), 1 main branch.
- Backend port 5100, dashboard port 5103.
```

- [ ] **Step 7: Commit screenshots + README**

```bash
cd c:\pro\carekit
git add docs/audits/single-organization-mode/
git commit -m "docs(audits): QA walkthrough for single-organization mode"
```

---

## Task G9 — Push and finalize

- [ ] **Step 1: Push branch**

```bash
git push origin feat/single-organization-mode
```

- [ ] **Step 2 (optional): Open draft PR**

If `gh` CLI is available:

```bash
gh pr create --draft --title "feat: single-organization mode" --body "$(cat <<'EOF'
## Summary
Convert CareKit from multi-tenant SaaS to single-organization deployment. One deployment = one organization with multiple physical branches.

## Stats
- Commits: ~30 across Plans A-G
- `tenantId` removed from all backend code, schema, frontend, tests
- `License` module deleted entirely
- `FeatureFlag`, `Integration`, `BrandingConfig`, `OrganizationSettings`, `ChatbotConfig`, `ZatcaConfig` now singletons / org-wide
- `Branch` model (physical locations) preserved

## Testing
- Backend: lint, build, test, test:e2e — all pass
- Dashboard: typecheck, lint, test, build — all pass
- Mobile: tsc --noEmit — passes
- Chrome DevTools MCP walkthrough: 13 pages captured in `docs/audits/single-organization-mode/`

## Migration Note
All 41 historical migrations replaced with one `initial_single_organization` migration since the project is still in development with no production data.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Otherwise: open a draft PR on GitHub manually.

- [ ] **Step 3: Mark Plan G complete**

```
✅ Plan G — Finalization — DONE

All 7 plans complete. Single-organization mode ready for review and merge.
```

---

## Rollback

Plan G doesn't change code significantly (seed + docs + QA). Rollback is simple:

```bash
git reset --hard <sha of last pre-Plan-G commit>
```

But since Plan G doesn't introduce breaking changes, a partial completion is usually fine — resume from the failed task.
