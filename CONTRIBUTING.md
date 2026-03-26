# Contributing to CareKit

Welcome to CareKit — a white-label smart clinic management platform. This guide gets you productive in under 30 minutes.

## Quick Setup

```bash
# 1. Clone & install
git clone <repo-url> && cd carekit
npm install

# 2. Environment
cp .env.example .env
# Fill in: DATABASE_URL, REDIS_URL, OPENROUTER_API_KEY, MOYASAR_API_KEY, ZOOM_*, FCM_*

# 3. Database
cd backend
npx prisma migrate dev
npx prisma db seed

# 4. Start everything
cd .. && npm run dev
# backend → http://localhost:3000
# dashboard → http://localhost:3001
# Swagger → http://localhost:3000/api/docs
```

## Before You Write Any Code

Read these files in order — skip none:

| # | File | What it covers |
|---|------|----------------|
| 1 | `CLAUDE.md` | Architecture decisions, coding standards, key rules |
| 2 | `ARCHITECTURE.md` | Module boundaries, feature list, decision log |
| 3 | `dashboard/DESIGN-SYSTEM.md` | Visual rules — frosted glass, tokens, RTL |
| 4 | `dashboard/components-policy.md` | Which components exist, when to create new ones |
| 5 | `docs/core/api-spec.md` | API contracts before touching backend |

## Layer Rules

### Backend (NestJS)

```
Controller  →  Service  →  Repository/Prisma
     ↓
   DTOs (input validation via class-validator)
   Guards (CASL permissions)
   Interceptors (logging, response transform)
```

- One module per domain feature (no god modules)
- Services contain all business logic — controllers are thin
- DTOs validate every incoming request
- Every endpoint has a `@ApiOperation` Swagger decorator
- Every service method has at least one unit test

### Dashboard (Next.js)

```
app/(dashboard)/[feature]/page.tsx   ← route entry point (thin)
  └── components/features/[feature]/ ← all UI components
        └── hooks/use-[feature].ts   ← data fetching & mutations
              └── lib/api/[feature].ts ← raw fetch calls
                    └── lib/types/[feature].ts ← TypeScript types
```

**Import direction is one-way downward — never import upward or sideways across features.**

## New Feature Checklist

Use this when adding any new feature end-to-end:

### Backend
- [ ] New module folder in `backend/src/modules/[feature]/`
- [ ] `[feature].module.ts` — module definition with imports
- [ ] `[feature].controller.ts` — routes with `@ApiOperation` decorators
- [ ] `[feature].service.ts` — business logic
- [ ] `dto/create-[feature].dto.ts` — input validation
- [ ] `dto/update-[feature].dto.ts` — update validation
- [ ] Prisma schema updated in `prisma/schema/`
- [ ] Migration created: `npx prisma migrate dev --name add_[feature]`
- [ ] Migration recorded in `docs/operations/migration-log.md`
- [ ] Unit tests in `[feature]/tests/[feature].service.spec.ts`
- [ ] Module registered in `app.module.ts`

### Dashboard
- [ ] Page: `dashboard/src/app/(dashboard)/[feature]/page.tsx`
- [ ] Components: `dashboard/src/components/features/[feature]/`
- [ ] Types: `dashboard/src/lib/types/[feature].ts`
- [ ] API client: `dashboard/src/lib/api/[feature].ts`
- [ ] Zod schema: `dashboard/src/lib/schemas/[feature].schema.ts`
- [ ] Query hook: `dashboard/src/hooks/use-[feature].ts`
- [ ] Mutation hook: `dashboard/src/hooks/use-[feature]-mutations.ts`
- [ ] Query keys: added to `dashboard/src/lib/query-keys.ts`
- [ ] Arabic translations: `dashboard/src/lib/translations/ar.[feature].ts`
- [ ] English translations: `dashboard/src/lib/translations/en.[feature].ts`
- [ ] Sidebar link added (if user-visible page)

## Pre-PR Checklist

Do not open a PR until every item is checked:

- [ ] No file exceeds **350 lines** (hard limit, no exceptions)
- [ ] No `any` TypeScript type (use `unknown` + type guard if needed)
- [ ] No hardcoded hex colors (use semantic tokens from `globals.css`)
- [ ] No `text-gray-*` classes (use `text-foreground` / `text-muted-foreground`)
- [ ] No raw `<input>`, `<select>`, `<textarea>` (use shadcn equivalents)
- [ ] No Lucide icons (use `@hugeicons/react` only)
- [ ] No cross-feature imports in dashboard
- [ ] No `prisma db push` (use `prisma migrate dev` only)
- [ ] RTL tested: layout works in Arabic (`dir="rtl"`)
- [ ] Loading state implemented (skeleton or spinner)
- [ ] Error state implemented (ErrorBanner or toast)
- [ ] Empty state implemented (EmptyState component)
- [ ] Unit tests pass: `npm run test` in backend
- [ ] TypeScript compiles: `npm run build` in affected workspace

## Commit Convention

Format: `type(scope): short description`

| Type | When to use |
|------|-------------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code change that neither adds feature nor fixes bug |
| `test` | Adding or updating tests |
| `docs` | Documentation only |
| `chore` | Tooling, deps, config — no production code |
| `perf` | Performance improvement |

**Examples:**
```
feat(bookings): add cancellation timeout task
fix(payments): handle Moyasar webhook retry correctly
refactor(auth): split OTP logic into dedicated service
test(bookings): add unit tests for cancellation flow
docs(api): update booking endpoints in api-spec.md
chore(deps): upgrade NestJS to 11.1
```

**Branch naming:**
```
feature/booking-cancellation-flow
fix/otp-email-not-sending
hotfix/moyasar-webhook-signature
release/v1.2.0
```

## Architecture Decision Records (ADRs)

When making a significant technical decision, document it in `docs/refactor-roadmap.md` under the ADR section. Include:
- **Context:** Why was a decision needed?
- **Decision:** What was chosen?
- **Consequences:** What trade-offs does this create?

## FAQ

**Q: Can I modify shadcn/ui components in `components/ui/`?**
A: No. These are primitives — wrap them in `components/features/` instead.

**Q: Can I add a new color or create a custom CSS class?**
A: No. Use existing tokens from `globals.css`. If a token is missing, add it there following the naming convention.

**Q: My file is getting close to 350 lines. What do I do?**
A: Split immediately by responsibility. A service with 300 lines likely has 2–3 concerns — extract each into its own service file.

**Q: Do I need a migration for every schema change?**
A: Yes — always `prisma migrate dev --name <descriptive_name>`. Never `prisma db push`.

**Q: Can I import a component from another feature folder?**
A: No. If two features need the same component, extract it to `components/ui/` (if generic) or `components/features/shared/` (if domain-specific).

**Q: Where do I put shared business logic used by multiple backend modules?**
A: In `backend/src/common/` — utilities, guards, interceptors, decorators, or a dedicated shared module.

**Q: How do I add a new permission/role?**
A: Define the permission string in `backend/src/common/constants/permissions.ts`, add a Prisma seed entry, and update the CASL factory.

**Q: The AI chatbot is returning wrong answers. Where do I look?**
A: Check `backend/src/modules/chatbot/` — specifically `chatbot-file.service.ts` (knowledge base) and `chatbot.helpers.ts` (prompt building).
