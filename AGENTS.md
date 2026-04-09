# CareKit — Agent Instructions

## What this repo is

npm workspaces + Turborepo monorepo. Four packages: `backend`, `dashboard`, `mobile`, `shared`.  
White-label clinic management. Every client gets an isolated Docker deployment.

---

## 🤖 Maestro Skill Auto-Dispatch (CareKit Edition)

> Maestro **automatically** loads the right skill for each agent. No manual selection needed.
> The table below is the single source of truth — Maestro reads this before every execution phase.

### TIER 1 — CareKit Custom Skills (always preferred)

| Trigger signals | Skill loaded | Agent | Replaces |
|----------------|-------------|-------|---------|
| Files in `backend/src/modules/` \| new NestJS module \| controller/service/dto/guard \| BullMQ \| CASL | **`nestjs-carekit`** | backend | `api-gen` |
| Any `.prisma` file \| prisma migrate \| schema change \| adding column/table/relation | **`prisma-carekit`** | db | `database-schema-designer` |
| New API endpoint \| `@ApiOperation` \| `@ApiProperty` \| REST route \| pagination \| webhook | **`api-design-carekit`** | backend | `api-gen` |
| Any `*.spec.ts` / `*.spec.tsx` \| writing tests \| vitest/jest/jest-expo \| TDD | **`tdd-carekit`** | test | `javascript-testing-patterns` |
| `*.e2e-spec.ts` \| Playwright \| `dashboard/test/e2e/` \| Supertest E2E | **`e2e-carekit`** | test | `e2e-testing-patterns` |
| auth/JWT/CASL \| payments/Moyasar \| ZATCA \| guards/decorators \| **risk=high/critical** | **`security-carekit`** | any | `api-security-best-practices` |
| Files in `mobile/` \| Expo screen \| Expo Router \| Redux slice \| `app/(patient)/` | **`mobile-carekit`** | mobile | `vercel-react-native-skills` |
| `docker-compose` \| `Dockerfile` \| `docker/` \| nginx \| white-label deploy | **`docker-carekit`** | devops | — |

### TIER 2 — Generic Skills (fallback only)

| Trigger signals | Skill loaded | Agent | When |
|----------------|-------------|-------|------|
| UI component in `dashboard/` \| design tokens \| `.glass` classes \| RTL \| shadcn | **`carekit-ds`** | frontend | ALWAYS for dashboard UI |
| Next.js 15 \| App Router \| React 19 \| TanStack Query \| performance | **`vercel-react-best-practices`** | frontend | With carekit-ds |
| Complex React state \| hook patterns \| composition | **`frontend-patterns`** | frontend | On demand |
| Code review requested \| quality check | **`review`** | any | On demand |
| Architecture decisions \| large refactor | **`architect`** | any | On demand |

### Auto-Dispatch Rules (non-negotiable)

```
1. TIER 1 always beats TIER 2 — if nestjs-carekit matches → don't load api-gen
2. security-carekit is mandatory when risk=high OR risk=critical, no exceptions
3. Paired loads:
   nestjs-carekit → also load api-design-carekit
   e2e-carekit    → also load tdd-carekit
   carekit-ds     → also load vercel-react-best-practices
4. Token savings: only load skills for agents in this task's dependency graph
```

### MCP Auto-Routing

```yaml
# Maestro routes to the RIGHT tool automatically:
db migrations  → mcp_prisma_migrate-dev / mcp_prisma_migrate-status
db queries     → mcp_postgres_query
git ops        → mcp_git_git_status / mcp_git_git_log / mcp_git_git_diff_unstaged
file ops       → mcp_filesystem_read_text_file / mcp_filesystem_list_directory
memory         → mcp_memory_create_entities / mcp_memory_search_nodes
docs lookup    → mcp_context7_resolve-library-id → mcp_context7_query-docs
shadcn API     → mcp_shadcn_list_shadcn_components / mcp_shadcn_get_component_details
E2E browser    → mcp_playwright_browser_*
perf/Lighthouse→ mcp_chrome-devtools_*
iOS Simulator  → mcp_ios-simulator_*
docker         → mcp_docker_run_command
complex plans  → mcp_sequential-thinking_sequentialthinking (auto on L/XL tasks)
```

---

## Dev commands

```bash
# From repo root
npm run docker:up          # Start PostgreSQL:5999, Redis:5380, MinIO:5200 — must run before backend
npm run dev:backend        # NestJS on :5000 (dev) / :5100 (Docker)
npm run dev:dashboard      # Next.js on :5001 (--turbopack)
npm run dev:mobile         # Expo Metro on :5002
npm run dev:all            # All in parallel via Turborepo

# Backend (cd backend/)
npm run prisma:migrate     # Run pending migrations — do this before first dev run
npm run prisma:seed        # Seed demo data
npm run prisma:studio      # Prisma GUI
npm run test               # Jest unit tests (test/unit/**/*.spec.ts)
npm run test:e2e           # Supertest against real DB (test/jest-e2e.json)
npm run test:cov           # Coverage — thresholds: 55% branch/line/stmt, 50% fn

# Dashboard (cd dashboard/)
npm run typecheck          # tsc --noEmit — run before pushing
npm run lint               # ESLint with boundary checks
npm run test               # Vitest (NOT Jest — test/**.spec.tsx with jsdom)
npm run test:e2e           # Playwright

# Mobile (cd mobile/)
npm run test               # jest-expo preset
```

**Pending migration on first setup:** `20260321232158_init` is untracked — always run `npm run prisma:migrate` in `backend/` before dev.

---

## Port map (all 5xxx — reserved exclusively for CareKit)

| Service | Dev port | Docker port |
|---------|----------|-------------|
| Backend API | 5000 | 5100 |
| Dashboard | 5001 | — |
| Expo / Metro | 5002 | — |
| PostgreSQL | 5999 | 5999 |
| Redis | 5380 | 5380 |
| MinIO S3 | 5200 | 5200 |
| MinIO Console | 5201 | 5201 |

API base path: `http://localhost:5000/api/v1`  
Swagger UI: `http://localhost:5000/api/docs`

---

## Shared package

`@carekit/shared` — import via subpath exports:

```ts
import { ... } from '@carekit/shared/types'
import { ... } from '@carekit/shared/enums'
import { ... } from '@carekit/shared/tokens'
import { ... } from '@carekit/shared/constants'
```

**Rule:** Frontend and mobile must import types from `@carekit/shared`, not define local duplicates. Any API contract change must update shared types first.

---

## Backend (NestJS)

**Module anatomy** (`src/modules/[feature]/`):
```
[feature].module.ts
[feature].controller.ts      # thin — delegates to service only
[feature].service.ts         # all business logic
[feature]-*.service.ts       # sub-service when main > 250 lines
dto/create-[feature].dto.ts
dto/update-[feature].dto.ts
tests/[feature].service.spec.ts
```

**Common layer** (`src/common/`): guards, decorators, filters, interceptors, pipes, middleware, queue helpers. Never duplicate these in modules.

**Prisma rules:**
- Schema is split by domain: `prisma/schema/[domain].prisma` (10 files: auth, base, bookings, chatbot, clinic, config, enums, payments, ratings, services)
- `base.prisma` = datasource + generator only — never add models there
- Always use `prisma migrate dev --name <descriptive>`, never `prisma db push`
- Use injected `PrismaService` singleton — never `new PrismaClient()`
- pgvector extension is enabled (for `ai/` module embeddings)
- All migration files are immutable — never edit existing ones

**Response shape:** All responses wrapped by interceptor as `{ success, data, error }`.

**Request pipeline:** CORS → Helmet → JWT Guard → CASL Permission Guard → Validation Pipe → Controller → Service → Response Interceptor.

**Auth note:** `rawBody: true` on Express — needed for Moyasar webhook HMAC verification. Don't remove it.

---

## Dashboard (Next.js)

**Strict one-way import chain:**
```
app/(dashboard)/[feature]/page.tsx   ≤120 lines
  → components/features/[feature]/   ≤300 lines
  → hooks/use-[feature].ts           ≤200 lines  (queries)
     use-[feature]-mutations.ts       (mutations — separate file)
  → lib/api/[feature].ts             ≤200 lines
  → lib/types/[feature].ts           ≤250 lines
  → lib/schemas/[feature].schema.ts  ≤150 lines
```

**Banned imports (ESLint enforced via `eslint-plugin-boundaries`):**
- `features/A → features/B` — cross-feature, always forbidden
- `lib/ → components/` or `lib/ → hooks/`
- `components/ → app/`

**When adding a new feature:** add it to the `FEATURES` array in `dashboard/eslint.config.mjs` or boundary checks will miss it.

**Design system:**
- Icons: `@hugeicons/react` exclusively — no Lucide, no Material Icons
- Colors: CSS custom properties only (`--primary`, `--surface`, `--border`, `--success`, `--warning`, `--error`) — no hardcoded hex, no `text-gray-*`
- Glass classes: `.glass`, `.glass-solid`, `.glass-strong` (defined in `app/globals.css` — single source of truth for all tokens)
- Spacing: `ps-`/`pe-`/`ms-`/`me-` directional utilities (RTL-safe), not `pl-`/`pr-`
- shadcn components in `components/ui/` — never modify them; wrap in `components/features/` instead
- Dark mode via CSS custom properties, not class-based toggling
- Every list page follows the exact anatomy in `CLAUDE.md` → "Page Anatomy — The Law"

**White-label note:** Never hardcode CareKit brand colors (`#354FD8`, `#82CC17`) as universal — each client overrides tokens via whitelabel config.

**i18n:** `next-intl`, translations in `lib/translations/[lang].[feature].ts`. RTL is the default layout; LTR is the override. All user-facing strings must have AR + EN entries.

**Testing:** Dashboard uses **Vitest** (not Jest). Test files live in `test/`.

---

## Mobile (Expo)

- Expo Router file-based routing — `_layout.tsx` defines each navigator
- Redux Toolkit slices in `stores/` — no React Context for global state
- Axios API clients in `services/` — one file per domain
- `expo-secure-store` for tokens; `AsyncStorage` for preferences (not the other way)
- Patient (`app/(patient)/`) and Practitioner (`app/(practitioner)/`) routes must stay strictly separated — no cross-imports
- No hardcoded strings — use i18n keys from `i18n/`
- No hardcoded colors — use tokens from `theme/`

---

## Universal rules (every workspace)

- **No `any` in TypeScript** — strict mode everywhere; use `unknown` + type guard
- **350-line hard limit** per file — split by responsibility when approaching
- **No inline styles**
- Every new backend endpoint: `@ApiOperation` + `@ApiProperty` on all DTOs
- Every new module: register in `app.module.ts`
- Every schema change: `prisma migrate dev --name <name>` + log entry in `docs/operations/migration-log.md`
- Commits: one system per commit, ≤10 files or ≤500 lines, conventional format (`feat(scope): ...`)

---

## Pre-PR checklist (13 items — all must pass)

```
□ No file > 350 lines
□ No `any` TypeScript type
□ No hardcoded hex colors
□ No text-gray-* Tailwind classes
□ No raw <input>/<select>/<textarea> (use shadcn equivalents)
□ No Lucide icons (use @hugeicons/react)
□ No cross-feature imports in dashboard
□ No prisma db push (use migrate dev)
□ RTL layout tested in Arabic (dir="rtl")
□ Loading / Error / Empty states implemented
□ Backend: npm run test passes
□ TypeScript builds: npm run build in affected workspace
□ Swagger decorators on all new endpoints
```

---

## Security-sensitive areas — require explicit @tariq review

`backend/src/modules/auth/`, `payments/`, `zatca/`, `invoices/`, `gift-cards/`, `coupons/`  
`backend/prisma/schema/`, `backend/prisma/migrations/`  
`backend/src/common/guards/`, `backend/src/common/decorators/`  
`dashboard/src/app/globals.css`, `dashboard/src/components/ui/`

---

## CI pipeline

Three parallel jobs on every push/PR to `main`:
1. **lint-and-test** (backend): `prisma generate` → `prisma migrate deploy` → unit tests → E2E tests (needs real Postgres + Redis)
2. **dashboard-check**: typecheck → lint → vitest
3. **mobile-check**: lint → jest-expo

---

## Key reference files

| Need | File |
|------|------|
| Commands + architecture | `CLAUDE.md` |
| Module map + domain boundaries | `ARCHITECTURE.md` |
| Dashboard visual rules | `dashboard/DESIGN-SYSTEM.md` |
| Component policy | `dashboard/components-policy.md` |
| New feature checklist | `CONTRIBUTING.md` |
| API contracts | `docs/core/api-spec.md` |
| Migration history | `docs/operations/migration-log.md` |
| ADRs / tech debt | `docs/refactor-roadmap.md` |
