# CareKit — Agent Team Configuration

## Default Workflow

Agent Team is **mandatory** for any task touching 2+ files.
3 teammates maximum per team. Lead coordinates only — does not write code.

---

## Standard 3-Teammate Split

```
maestro (Lead)
  Coordinates, reviews quality, enforces 350-line rule, approves deliveries
  ├── backend-dev
  │   Owns: backend/**
  │   Tools: NestJS modules, Prisma queries, DTOs, guards, BullMQ jobs
  │   Rules: No any, migrations immutable, tests before commit
  ├── dashboard-dev
  │   Owns: dashboard/**
  │   Tools: Next.js App Router, TanStack Query, shadcn/ui, Tailwind 4
  │   Rules: Layer rules (app→components→hooks→lib), DS compliance, RTL
  └── mobile-dev
      Owns: mobile/**
      Tools: Expo Router, Redux Toolkit, React Native components
      Rules: Patient/Practitioner split, i18n via i18next
```

## When to use 2-teammate variant

If the task is backend-only or dashboard-only, use:
```
maestro (Lead)
  ├── backend-dev OR dashboard-dev OR mobile-dev   (primary implementer)
  └── qa-engineer                                   (tests + validation)
```

## Special-purpose agents

| Agent | Use when |
|-------|----------|
| `ai-engineer` | Chatbot, RAG pipeline, knowledge base, streaming |
| `frontend-architect` | Designing new page structure or component hierarchy |
| `feature-dev:code-explorer` | Tracing unfamiliar code paths before implementing |
| `feature-dev:code-reviewer` | Pre-commit review for sensitive modules |

## File Ownership (hard boundaries)

| Path | Owner | Cross-boundary? |
|------|-------|-----------------|
| `backend/prisma/schema/**` | backend-dev | maestro approval required |
| `backend/prisma/migrations/**` | backend-dev | maestro approval, immutable |
| `backend/src/modules/auth/**` | backend-dev | owner (@tariq) review |
| `backend/src/modules/payments/**` | backend-dev | owner (@tariq) review |
| `backend/src/modules/zatca/**` | backend-dev | owner (@tariq) review |
| `dashboard/app/**` | dashboard-dev | orchestration only |
| `dashboard/components/ui/**` | dashboard-dev | shadcn — do not modify |
| `dashboard/lib/**` | dashboard-dev | no UI imports allowed |
| `mobile/**` | mobile-dev | — |
| `shared/**` | maestro | all teammates read, maestro writes |

## Delivery Checklist (per teammate)

Before handing off to Lead for review:
- [ ] `npm run test` passes (or `npm run test:cov` for backend)
- [ ] No `any` types introduced
- [ ] No file exceeds 350 lines
- [ ] Imports follow layer rules (dashboard) or module boundaries (backend)
- [ ] New migrations are forward-only (no modifications to existing)
- [ ] Sensitive modules flagged for owner review
