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

```
src/
  common/          # p1-t6..t9 — tenant, guards, interceptors, filters, event base
  infrastructure/  # p1-t2..t5 — prisma, redis, bullmq, minio, fcm, smtp
  modules/         # p2..p11 — one bounded context per folder
  api/             # p12 — dashboard, mobile, public controllers
  main.ts
  app.module.ts
```
