# CareKit Backend v2

Rebuild from scratch on Bounded Contexts + Vertical Slices.

- Spec: [`docs/superpowers/specs/2026-04-11-backend-architecture-design.md`](../../docs/superpowers/specs/2026-04-11-backend-architecture-design.md)
- Kanban: [`docs/plan/kanban.html`](../../docs/plan/kanban.html)
- v1 snapshot: `git checkout backend-v1-archive -- apps/backend/`

## Quick start

```bash
cp .env.example .env
npm install
npm run dev   # http://localhost:5100
```

## Layout

```text
apps/backend/
├── prisma/
│   └── schema/            # Prisma DSL — one .prisma file per BC (p1-t2)
├── src/
│   ├── config/            # env validation (Joi). Typed configs added per-BC.
│   ├── common/            # p1-t6..t9 — tenant, guards, interceptors, filters
│   ├── infrastructure/    # adapters for external systems (one folder each)
│   │   ├── database/      # p1-t2 — PrismaService wrapper
│   │   ├── queue/         # p1-t3 — BullMQ
│   │   ├── cache/         # p1-t3 — Redis
│   │   ├── storage/       # p1-t4 — MinIO
│   │   ├── mail/          # p1-t5 — SMTP + FCM
│   │   └── events/        # p1-t9 — BaseEvent + event-bus
│   ├── modules/           # p2..p11 — one folder per bounded context
│   ├── api/               # p12 — dashboard / mobile / public controllers
│   ├── main.ts
│   └── app.module.ts
```

## Architectural decisions

### Prisma schema location: `apps/backend/prisma/schema/`

Prisma schema DSL lives at the package root — NOT inside `src/infrastructure/database/`.

**Reasons:**

1. Prisma convention. IDE tooling, `prisma generate`, and migration scripts expect `./prisma/schema/` relative to the package root. Moving it forces `prisma.config.ts` overrides for every command.
2. `.prisma` files are not TypeScript. They're a separate DSL with their own compiler. Co-locating them with TS code mixes two different artifact types.
3. The **generated Prisma client** (`@prisma/client`) is what belongs in the infrastructure layer — not the schema source. `PrismaService` in `src/infrastructure/database/prisma.service.ts` wraps the generated client. That's the architectural boundary.
4. Split-schema strategy (one `.prisma` file per BC) is native to Prisma 7's `schema` folder — no custom tooling needed.

### Vertical Slices inside modules

Each bounded context under `src/modules/<bc>/` is further subdivided by **slice** (feature), not by layer:

```text
modules/identity/
  login/              ← slice
    login.command.ts
    login.dto.ts
    login.handler.ts
    login.controller.ts
    login.spec.ts
    login.e2e-spec.ts
  refresh-token/      ← slice
    ...
```

No shared `controllers/`, `services/`, or `dtos/` folders. Every feature ships with all its layers in one place. See `docs/superpowers/specs/2026-04-11-backend-architecture-design.md`.
