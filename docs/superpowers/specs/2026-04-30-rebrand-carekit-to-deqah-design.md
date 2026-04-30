# Rebrand: CareKit → Deqah

**Date:** 2026-04-30  
**Status:** Approved

## Summary

Full rebrand of the platform from CareKit to Deqah (دِقة — نظام إدارة الحجوزات والمواعيد). All occurrences of the old name are replaced across code, configuration, documentation, and user-facing content. The root directory `/Users/tariq/code/carekit/` is kept as-is (local working directory only).

## Substitution Map

| Old | New | Case sensitivity |
|-----|-----|-----------------|
| `CareKit` | `Deqah` | exact |
| `carekit` | `deqah` | exact |
| `@carekit/` | `@deqah/` | exact |
| `CAREKIT` | `DEQAH` | exact (env vars) |

Arabic name `دِقة` and tagline `نظام إدارة الحجوزات والمواعيد` are added/verified in user-facing email templates and Swagger docs — no removal needed as they don't exist yet.

## Layers (execution order)

### Layer 1 — package.json files
Files: root `package.json`, all `apps/*/package.json`, all `packages/*/package.json`  
Changes: `name`, `description`, workspace references, `@carekit/*` deps → `@deqah/*`

### Layer 2 — TypeScript/TSX imports
All `.ts` and `.tsx` files: `from '@carekit/` → `from '@deqah/`  
All `tsconfig.json` path aliases: `@carekit/*` → `@deqah/*`

### Layer 3 — Configuration files
- `.env.example` and any `.env.*`: DB name, app name env vars
- `docker-compose.yml`: DB name, service labels
- `nginx.conf` / `docker/`: service references
- Prisma schema files: `url = env("DATABASE_URL")` target DB name comment, datasource block name if branded
- `turbo.json`, `.eslintrc`, `.prettierrc`: any name references

### Layer 4 — Source code (strings, comments, Swagger)
- `main.ts`: Swagger `title`, `description`
- Email templates (`apps/backend/src/infrastructure/mail/templates/*.ts`): brand name in subject lines, body copy, footer — replace `CareKit` with `Deqah` and add Arabic tagline where appropriate
- `platform-mailer.service.ts`: sender name
- Guards, interceptors, comments: `CareKit` → `Deqah`
- Any hardcoded string `"CareKit"` or `'CareKit'` in source

### Layer 5 — Documentation & memory
- `CLAUDE.md` (root)
- `apps/backend/CLAUDE.md`
- `docs/superpowers/plans/*.md`
- `docs/superpowers/specs/*.md`
- `docs/architecture/*.md`
- `memory/MEMORY.md` and all `memory/*.md`
- `MAESTRO.md`, `AGENTS.md`, `PATHS.md`, `QUICK_REFERENCE.md`

## Database

The Prisma `DATABASE_URL` env var points to `postgresql://.../{dbname}`. Change `carekit` → `deqah` in:
- `.env.example`
- `docker-compose.yml` (POSTGRES_DB)
- Local `.env` files (developer responsibility — noted in plan)

The physical database rename on local dev: `ALTER DATABASE carekit RENAME TO deqah;` — included as a one-time migration note, not a Prisma migration file.

## What does NOT change

- Root directory name `/carekit/`
- Git history
- Kiwi TCMS product name (separate system, update manually if needed)
- Mobile bundle identifiers (`sa.sawa.app`) — tenant-level, not platform-level

## Verification steps (after each layer)

1. `npm run typecheck` — no new errors
2. `grep -r "CareKit\|@carekit" . --include="*.ts" --include="*.tsx" --include="*.json" | grep -v node_modules | grep -v ".git"` — count approaches zero
3. `cd apps/backend && npm run test` — all tests pass

## Risks

- **Import breakage**: `@carekit/*` → `@deqah/*` touches every file that imports shared packages. Typecheck catches all breaks.
- **node_modules**: not touched by sed; `npm install` after package.json changes regenerates lockfile with new names.
- **Local .env**: developers must manually update their local DATABASE_URL. Document in plan.
