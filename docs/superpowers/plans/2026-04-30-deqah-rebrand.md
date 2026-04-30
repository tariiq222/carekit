# Rebrand Deqah → Deqah Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every occurrence of "Deqah" / "deqah" with "Deqah" / "deqah" across the entire monorepo — package names, imports, configuration, source strings, email templates, and documentation — and rename the PostgreSQL database.

**Architecture:** Five sequential layers executed with `sed` and targeted file edits, each verified with typecheck + grep before proceeding to the next. Layer order: package.json → tsconfig paths → source imports → runtime strings/config → docs.

**Tech Stack:** Node.js monorepo (npm workspaces + Turborepo), NestJS backend, Next.js apps, Expo mobile, PostgreSQL via Prisma.

---

## File Map

### Layer 1 — package.json files (9 files)
- Modify: `package.json`
- Modify: `apps/backend/package.json`
- Modify: `apps/dashboard/package.json`
- Modify: `apps/admin/package.json`
- Modify: `apps/website/package.json`
- Modify: `apps/mobile/package.json`
- Modify: `packages/ui/package.json`
- Modify: `packages/shared/package.json`
- Modify: `packages/api-client/package.json`

### Layer 2 — tsconfig path aliases (3 files)
- Modify: `apps/dashboard/tsconfig.json`
- Modify: `apps/admin/tsconfig.json`
- Modify: `apps/website/tsconfig.json`

### Layer 3 — TypeScript/TSX imports (239 import statements across many files)
- Bulk `sed` on all `.ts` / `.tsx` files

### Layer 4 — Configuration & runtime strings
- Modify: `.env.example`
- Modify: `apps/backend/.env.example`
- Modify: `docker/docker-compose.yml`
- Modify: `apps/backend/src/main.ts`
- Modify: `apps/backend/src/infrastructure/mail/templates/shared.ts`
- Modify: `apps/backend/src/infrastructure/mail/templates/otp-login.template.ts`
- Modify: `apps/backend/src/infrastructure/mail/templates/tenant-welcome.template.ts`
- Modify: `apps/backend/src/infrastructure/mail/templates/trial-ending.template.ts`
- Modify: `apps/backend/src/infrastructure/mail/templates/trial-expired.template.ts`
- Modify: `apps/backend/src/infrastructure/mail/templates/subscription-payment-failed.template.ts`
- Modify: `apps/backend/src/infrastructure/mail/templates/subscription-payment-succeeded.template.ts`
- Modify: `apps/backend/src/infrastructure/mail/templates/plan-changed.template.ts`
- Modify: `apps/backend/src/infrastructure/mail/templates/dunning-retry.template.ts`
- Modify: `apps/backend/src/infrastructure/mail/templates/account-status-changed.template.ts`
- Modify: `apps/backend/src/infrastructure/mail/templates/trial-suspended-no-card.template.ts`
- Modify: `apps/backend/src/infrastructure/mail/platform-mailer.service.ts`
- Modify: `apps/backend/openapi.json`
- All remaining `.ts`/`.tsx` files with `Deqah` or `deqah` in strings/comments

### Layer 5 — Documentation
- Modify: `CLAUDE.md`
- Modify: `apps/backend/CLAUDE.md`
- Modify: `MAESTRO.md` (if exists)
- Modify: `AGENTS.md`
- Modify: `PATHS.md`
- Modify: `QUICK_REFERENCE.md`
- Modify: `memory/MEMORY.md` and all `memory/*.md`
- Bulk `sed` on all `docs/**/*.md`

---

## Task 1: Rename package names in all package.json files

**Files:** `package.json`, `apps/*/package.json`, `packages/*/package.json`

- [ ] **Step 1: Run sed to replace deqah in all package.json files**

```bash
find /Users/tariq/code/deqah -name "package.json" \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -not -path "*/.claude/worktrees/*" \
  -exec sed -i '' \
    -e 's/"deqah"/"deqah"/g' \
    -e 's/@deqah\//@deqah\//g' \
    -e 's/Deqah/Deqah/g' \
    {} +
```

- [ ] **Step 2: Verify the changes**

```bash
grep -r "deqah\|Deqah\|@deqah" /Users/tariq/code/deqah \
  --include="package.json" \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=.claude
```

Expected: zero results.

- [ ] **Step 3: Reinstall dependencies to update lockfile**

```bash
cd /Users/tariq/code/deqah && npm install
```

Expected: installs cleanly, `package-lock.json` updated with `@deqah/*` references.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json apps/*/package.json packages/*/package.json
git commit -m "chore: rename packages from deqah to deqah"
```

---

## Task 2: Update tsconfig path aliases

**Files:** `apps/dashboard/tsconfig.json`, `apps/admin/tsconfig.json`, `apps/website/tsconfig.json`

- [ ] **Step 1: Replace @deqah path aliases**

```bash
find /Users/tariq/code/deqah -name "tsconfig*.json" \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -not -path "*/.claude/worktrees/*" \
  -exec sed -i '' 's/@deqah\//@deqah\//g' {} +
```

- [ ] **Step 2: Verify**

```bash
grep -r "@deqah" /Users/tariq/code/deqah \
  --include="tsconfig*.json" \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=.claude
```

Expected: zero results.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/tsconfig.json apps/admin/tsconfig.json apps/website/tsconfig.json
git commit -m "chore: update tsconfig paths from @deqah to @deqah"
```

---

## Task 3: Replace all @deqah imports in TypeScript source files

**Files:** All `.ts` and `.tsx` files in `apps/` and `packages/`

- [ ] **Step 1: Run sed across all TypeScript files**

```bash
find /Users/tariq/code/deqah -type f \( -name "*.ts" -o -name "*.tsx" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -not -path "*/.claude/worktrees/*" \
  -exec sed -i '' "s/@deqah\//@deqah\//g" {} +
```

- [ ] **Step 2: Verify no @deqah imports remain**

```bash
grep -r "from '@deqah/\|from \"@deqah/" /Users/tariq/code/deqah \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=.claude | wc -l
```

Expected: 0

- [ ] **Step 3: Run typecheck on backend**

```bash
cd /Users/tariq/code/deqah/apps/backend && npx tsc --noEmit 2>&1 | head -30
```

Expected: same errors as before this task (no new errors introduced).

- [ ] **Step 4: Run typecheck on dashboard**

```bash
cd /Users/tariq/code/deqah/apps/dashboard && npm run typecheck 2>&1 | tail -20
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/tariq/code/deqah
git add -A
git commit -m "chore: replace @deqah imports with @deqah across all source files"
```

---

## Task 4: Replace Deqah/deqah strings in all remaining TypeScript/TSX source

**Files:** All `.ts` and `.tsx` files

- [ ] **Step 1: Replace all remaining Deqah / deqah string occurrences**

```bash
find /Users/tariq/code/deqah -type f \( -name "*.ts" -o -name "*.tsx" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -not -path "*/.claude/worktrees/*" \
  -exec sed -i '' \
    -e 's/Deqah/Deqah/g' \
    -e 's/deqah/deqah/g' \
    {} +
```

- [ ] **Step 2: Verify no Deqah/deqah remain in source**

```bash
grep -r "Deqah\|deqah" /Users/tariq/code/deqah \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=.claude
```

Expected: zero results.

- [ ] **Step 3: Run backend tests**

```bash
cd /Users/tariq/code/deqah/apps/backend && npm run test 2>&1 | tail -20
```

Expected: all tests pass (same count as before).

- [ ] **Step 4: Commit**

```bash
cd /Users/tariq/code/deqah
git add -A
git commit -m "chore: replace Deqah strings with Deqah in all TypeScript source"
```

---

## Task 5: Update Swagger/API metadata in main.ts

**File:** `apps/backend/src/main.ts`

- [ ] **Step 1: Verify current state (should already be updated by Task 4)**

```bash
grep -n "Deqah\|deqah\|Deqah\|deqah" /Users/tariq/code/deqah/apps/backend/src/main.ts
```

- [ ] **Step 2: If any Deqah remains, manually set the correct Swagger metadata**

Edit `apps/backend/src/main.ts` — find the Swagger DocumentBuilder block and ensure it reads:

```typescript
.setTitle('Deqah API')
.setDescription('Deqah — نظام إدارة الحجوزات والمواعيد — dashboard & mobile API')
.setContact('Deqah Engineering', 'https://deqah.app', 'dev@deqah.app')
.setLicense('Proprietary', 'https://deqah.app/license')
```

And the Logger line:
```typescript
Logger.log(`Deqah Backend listening on http://localhost:${port}`, 'Bootstrap');
```

- [ ] **Step 3: Commit if changed**

```bash
git add apps/backend/src/main.ts
git commit -m "chore: update Swagger metadata to Deqah brand"
```

---

## Task 6: Update environment files and Docker configuration

**Files:** `.env.example`, `apps/backend/.env.example`, `docker/docker-compose.yml`

- [ ] **Step 1: Update root .env.example**

```bash
sed -i '' \
  -e 's/deqah/deqah/g' \
  -e 's/Deqah/Deqah/g' \
  /Users/tariq/code/deqah/.env.example
```

- [ ] **Step 2: Update backend .env.example**

```bash
sed -i '' \
  -e 's/deqah/deqah/g' \
  -e 's/Deqah/Deqah/g' \
  /Users/tariq/code/deqah/apps/backend/.env.example
```

- [ ] **Step 3: Update docker-compose.yml**

```bash
sed -i '' \
  -e 's/deqah/deqah/g' \
  -e 's/Deqah/Deqah/g' \
  /Users/tariq/code/deqah/docker/docker-compose.yml
```

- [ ] **Step 4: Verify**

```bash
grep -n "deqah\|Deqah" \
  /Users/tariq/code/deqah/.env.example \
  /Users/tariq/code/deqah/apps/backend/.env.example \
  /Users/tariq/code/deqah/docker/docker-compose.yml
```

Expected: zero results.

- [ ] **Step 5: Commit**

```bash
git add .env.example apps/backend/.env.example docker/docker-compose.yml
git commit -m "chore: update env and docker config to deqah database/service names"
```

---

## Task 7: Rename PostgreSQL database

> **Note to developer:** This renames the local dev database. Each developer on the team must run this command on their own machine. Production DB rename is a separate ops procedure.

- [ ] **Step 1: Rename the dev database (if running)**

```bash
# Stop the app first, then:
psql -U postgres -h localhost -p 5432 -c "ALTER DATABASE deqah_dev RENAME TO deqah_dev;" 2>/dev/null || \
psql -U deqah -h localhost -p 5433 -c "ALTER DATABASE deqah_dev RENAME TO deqah_dev;" 2>/dev/null || \
echo "DB rename may need manual step — check your local .env for the correct connection"
```

- [ ] **Step 2: Update your local .env file**

Open `apps/backend/.env` (not committed) and change:
```
DATABASE_URL=postgresql://deqah:deqah_dev_password@localhost:5432/deqah_dev?schema=public
```

Replace `deqah` with `deqah` in the entire URL.

- [ ] **Step 3: Verify backend connects**

```bash
cd /Users/tariq/code/deqah/apps/backend && npm run dev &
sleep 5 && curl -s http://localhost:5100/health | head -5
kill %1
```

Expected: health endpoint responds (no DB connection errors).

- [ ] **Step 4: Commit note (no code change needed — .env is gitignored)**

```bash
git commit --allow-empty -m "chore: note — local DB renamed from deqah_dev to deqah_dev"
```

---

## Task 8: Update JSON and YAML files (openapi.json, nginx, turbo)

**Files:** `apps/backend/openapi.json`, any `.yml`/`.yaml` files

- [ ] **Step 1: Update all JSON files**

```bash
find /Users/tariq/code/deqah -name "*.json" \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -not -path "*/.claude/worktrees/*" \
  -not -name "package-lock.json" \
  -exec sed -i '' \
    -e 's/Deqah/Deqah/g' \
    -e 's/deqah/deqah/g' \
    {} +
```

- [ ] **Step 2: Update all YAML files**

```bash
find /Users/tariq/code/deqah -name "*.yml" -o -name "*.yaml" | \
  grep -v node_modules | grep -v .git | grep -v ".claude/worktrees" | \
  xargs sed -i '' \
    -e 's/Deqah/Deqah/g' \
    -e 's/deqah/deqah/g'
```

- [ ] **Step 3: Verify**

```bash
grep -r "Deqah\|deqah" /Users/tariq/code/deqah \
  --include="*.json" --include="*.yml" --include="*.yaml" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.claude \
  --exclude="package-lock.json"
```

Expected: zero results.

- [ ] **Step 4: Commit**

```bash
cd /Users/tariq/code/deqah
git add -A
git commit -m "chore: update JSON and YAML files to Deqah brand"
```

---

## Task 9: Update documentation and CLAUDE.md files

**Files:** `CLAUDE.md`, `apps/backend/CLAUDE.md`, `AGENTS.md`, `MAESTRO.md`, `PATHS.md`, `QUICK_REFERENCE.md`, all `docs/**/*.md`, all `memory/*.md`

- [ ] **Step 1: Replace in all markdown files**

```bash
find /Users/tariq/code/deqah -name "*.md" \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -not -path "*/.claude/worktrees/*" \
  -exec sed -i '' \
    -e 's/Deqah/Deqah/g' \
    -e 's/deqah/deqah/g' \
    {} +
```

- [ ] **Step 2: Verify**

```bash
grep -r "Deqah\|deqah" /Users/tariq/code/deqah \
  --include="*.md" \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=.claude | grep -v "worktrees" | wc -l
```

Expected: 0 (or a small number that are intentional historical references in old plan files — inspect and decide).

- [ ] **Step 3: Commit**

```bash
cd /Users/tariq/code/deqah
git add -A
git commit -m "docs: rebrand all documentation from Deqah to Deqah"
```

---

## Task 10: Final verification sweep

- [ ] **Step 1: Full grep sweep across all file types**

```bash
grep -r "Deqah\|@deqah\|deqah" /Users/tariq/code/deqah \
  --include="*.ts" --include="*.tsx" \
  --include="*.json" --include="*.md" \
  --include="*.yml" --include="*.yaml" \
  --include="*.env*" \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=.claude \
  --exclude="package-lock.json" \
  -l
```

Expected: zero files. If any remain, fix manually and commit.

- [ ] **Step 2: Run full backend test suite**

```bash
cd /Users/tariq/code/deqah/apps/backend && npm run test 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 3: Run backend typecheck**

```bash
cd /Users/tariq/code/deqah/apps/backend && npx tsc --noEmit 2>&1 | tail -10
```

Expected: no new errors.

- [ ] **Step 4: Run dashboard typecheck**

```bash
cd /Users/tariq/code/deqah/apps/dashboard && npm run typecheck 2>&1 | tail -10
```

Expected: no new errors.

- [ ] **Step 5: Final commit**

```bash
cd /Users/tariq/code/deqah
git add -A
git commit -m "chore: complete rebrand from Deqah to Deqah"
```

---

## Developer Checklist (post-merge)

Each developer on the team must do the following after pulling this branch:

1. Rename local DB: `psql -c "ALTER DATABASE deqah_dev RENAME TO deqah_dev;"`
2. Update local `.env`: change `deqah` → `deqah` in `DATABASE_URL`
3. Run `npm install` to refresh node_modules symlinks
4. Restart Docker: `npm run docker:down && npm run docker:up`
