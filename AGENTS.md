# Maestro v10 — Deqah Agents

> **Status (2026-04-25): available, not mandatory.** Day-to-day Deqah work flows through superpowers skills (`writing-plans`, `executing-plans`, `dispatching-parallel-agents`, `brainstorming`) on plain feature branches. The roster below is real — each agent has a spec in `agents/*.md` and the `/plan`, `/execute`, `/verify`, `/maestro` slash commands resolve — but you opt into Maestro per task; you do not have to route every request through it.

A tiered multi-agent system built entirely on Claude Code, tuned for the Deqah monorepo. When invoked, a cheap Router triages the request and routes it to one of three paths (Fast / Standard / Deep) with different budgets, agents, and deliverables.

---

## 📚 Files You Must Know

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Project rules, stack, domain map, design law |
| `docs/ai/MAESTRO.md` | Maestro v10 entry point — how to activate |
| `AGENTS.md` | This file — agent roster + flow |
| `docs/ai/PATHS.md` | Path playbook — budgets, agents, SLA per path (heuristic) |
| `agents/*.md` | Individual agent specs |

For worktree mechanics, use `superpowers:using-git-worktrees` (the previous `WORKTREES.md` and its 5110/5120/5130 port table were retired). When you do invoke Maestro, skim `docs/ai/PATHS.md` to pick a lane.

---

## 1. The Agent Roster

| Agent | Model | Role | Writes Code? |
|-------|-------|------|:------------:|
| 🎛️ **Yazid** (router) | `claude-haiku-4-5-20251001` | Triage — classify request into FAST/STANDARD/DEEP | ❌ |
| 👑 **Fahad** (maestro) | `claude-opus-4-7` | Chief orchestrator — plans, delegates, reviews | ❌ |
| 🔭 **Sultan** (explorer) | `claude-sonnet-4-6` | **Scoped** codebase discovery (STANDARD/DEEP only) | ❌ |
| 🏗️ **Rashed** (architect) | `claude-opus-4-7` | Architecture, DB schema, API contracts (DEEP only) | ❌ |
| 💻 **Nawaf** (backend) | `claude-sonnet-4-6` | NestJS 11 / Prisma 7 / PostgreSQL + pgvector / BullMQ / Redis / MinIO | ✅ |
| 🎨 **Khaled** (frontend) | `claude-sonnet-4-6` | Next.js 15 (App Router) + React 19 · React Native 0.83 + Expo SDK 55 · Tailwind 4 · shadcn/ui · next-intl | ✅ |
| 🧪 **Saad** (tester) | `claude-sonnet-4-6` | Jest + Supertest + Vitest + Chrome DevTools MCP for manual QA · Kiwi TCMS sync | ✅ |
| 🔍 **Majed** (type-checker) | `claude-sonnet-4-6` | TypeScript strict, Zod schemas, ESLint, Prettier | ✅ |
| 🔒 **Abdullah** (security) | `claude-opus-4-7` | Security review — owner-only tiers (payments, ZATCA, auth, migrations, schema, CODEOWNERS) | ❌ |
| ♻️ **Badr** (refactor) | `claude-sonnet-4-6` | Refactor within the 350-line rule | ✅ |
| 📝 **Salem** (docs) | `claude-sonnet-4-6` | JSDoc, README, migration notes, ADRs — AR+EN when user-facing | ✅ |
| ⚙️ **Turki** (devops) | `claude-sonnet-4-6` | Docker Compose, Turborepo, GitHub Actions, Prisma migrations | ✅ |
| 📘 **Omar** (historian) | `claude-sonnet-4-6` | Retrospective, changelog, Kiwi link roll-up (DEEP only) | ✅ |

**Golden rule:** Fahad, Rashed, and Abdullah (all Opus) never write code — they plan, design, or audit.

---

## 2. The Orchestration Flow

```
USER REQUEST
    │
    ▼
┌──────────────────────────────────────────┐
│ 1. ROUTE (Yazid / Haiku)                 │ ← ~200 tokens, < $0.01
│   JSON output: path + type + size + risk │
└───────────┬──────────────────────────────┘
            │
            ▼
   ┌────────┼────────┐
   ▼        ▼        ▼
┌──────┐ ┌─────────┐ ┌──────┐
│ FAST │ │STANDARD │ │ DEEP │
└──────┘ └─────────┘ └──────┘
  │          │          │
  │          ▼          ▼
  │    ┌──────────┐ ┌─────────────┐
  │    │ Sultan   │ │ Sultan full │
  │    │ scoped   │ │ Rashed      │
  │    │ 5K tok   │ │ Clarify Qs  │
  │    └─────┬────┘ │ 20K tok     │
  │          │      └──────┬──────┘
  │          │             │
  ▼          ▼             ▼
┌────────────────────────────────┐
│ 2. PLAN (Fahad / Opus)         │
│   Subtasks, agents, tests      │
└──────────────┬─────────────────┘
               │
               ▼
┌────────────────────────────────┐
│ 3. WORKTREE (if DEEP)          │
│   Isolated dir, own DB + port  │
│   deqah_<slug>, 5110+        │
└──────────────┬─────────────────┘
               │
               ▼
┌────────────────────────────────┐
│ 4. EXECUTE (Sonnet agents)     │
│   Parallel when independent    │
└──────────────┬─────────────────┘
               │
               ▼
┌────────────────────────────────┐
│ 5. GATES                       │
│   FAST:     type + lint        │
│   STANDARD: + unit + int       │
│   DEEP:     + E2E + security   │
│   ALL STANDARD+/DEEP: Kiwi sync│
└──────────────┬─────────────────┘
               │
               ▼
┌────────────────────────────────┐
│ 6. REVIEW (Fahad/Opus)         │
│   + Abdullah if DEEP           │
│   + Rashed if schema touched   │
└──────────────┬─────────────────┘
               │
               ▼
┌────────────────────────────────┐
│ 7. RETRO (Omar, DEEP only)     │
│   Changelog, lessons, ADR      │
│   + Kiwi plan/run URLs         │
└──────────────┬─────────────────┘
               │
               ▼
            DELIVER
   + Budget report (tokens, cost)
```

---

## 3. Token Budget Matrix

Fahad tracks spend live. Exceeding budget by 20% halts and asks for user approval.

| Path | Total Budget | Cost Target | Time Target | Agents |
|------|:------------:|:-----------:|:-----------:|:------:|
| FAST | 5K–15K | < $0.05 | < 1 min | 2–3 |
| STANDARD | 30K–80K | $0.30–$0.80 | 5–15 min | 4–6 |
| DEEP | 150K–500K | $3–$15 | 30min–2hr | 8–13 |

**Target distribution across all tasks:**
- Yazid (Haiku): 100% of requests, ~1% of token spend
- Sonnet execution: ~65% of token spend
- Opus orchestration: ~25% of token spend
- Opus specialist review: ~10% of token spend

---

## 4. Gate Matrix (Quality Requirements)

| Gate | FAST | STANDARD | DEEP |
|------|:----:|:--------:|:----:|
| Type-check (`turbo run typecheck` / `npm run typecheck`) | ✅ | ✅ | ✅ |
| Lint (`turbo run lint`) | ✅ | ✅ | ✅ |
| Unit tests (Jest / Vitest) | — | ✅ | ✅ |
| Integration tests (Supertest) | — | ✅ | ✅ |
| E2E tests (Chrome DevTools MCP walk-through) | — | — | ✅ |
| Security review (Abdullah) | — | — | ✅ |
| Architecture review (Rashed) | — | If schema | ✅ |
| Regression check (Omar) | — | — | ✅ |
| Kiwi TCMS sync (`npm run test:kiwi` / `kiwi:sync-manual`) | — | ✅ | ✅ |
| Changelog entry | — | — | ✅ |
| ADR (if applicable) | — | — | ✅ |

---

## 5. Git Strategy Matrix

| Path | Branch | Workspace | PR? |
|------|--------|-----------|:---:|
| FAST | Current or `fix/*` | Main workspace, in place | Optional |
| STANDARD | `feat/*` or `fix/*` | Main workspace | ✅ |
| DEEP | `feat/*` with worktree | **Isolated worktree** | ✅ |

For worktree mechanics, use the `superpowers:using-git-worktrees` skill.

**Commit rules (from CLAUDE.md):** one system only per commit · ≤ 10 files or ≤ 500 lines · conventional format (`feat(bookings): …`).

---

## 6. Forbidden Patterns (Anti-patterns)

Fahad rejects any deliverable showing these:

- ❌ `any` without justification — strict TypeScript, no exceptions
- ❌ `@ts-ignore` — use `@ts-expect-error` with a linked issue
- ❌ `console.log` in production code — use NestJS `Logger` (backend) or silently drop (frontend)
- ❌ Hardcoded secrets — read from env via `ConfigService`
- ❌ `SELECT *` / missing Prisma `select:` — always narrow
- ❌ N+1 queries — use `include` or `in`
- ❌ UI text without an i18n key — next-intl only, AR+EN
- ❌ Missing RTL support — logical properties only (`ps-`/`pe-`/`ms-`/`me-`), no `ml-`/`mr-`
- ❌ Hex colors in code — use semantic tokens (`--primary`, `--accent`, …) so the branding system works
- ❌ `text-gray-*` or Tailwind color utilities for brand surfaces — use `text-muted-foreground`, etc.
- ❌ Magic numbers/strings without constants
- ❌ Commented-out code (delete or ticket it)
- ❌ Files > 350 lines — split before you cross
- ❌ `prisma db push` or manual SQL — migrations only
- ❌ Editing an existing Prisma migration — migrations are immutable
- ❌ New Product in Kiwi TCMS (only `Deqah`) — distinguish by Category + Plan type
- ❌ Playwright re-introduction — removed 2026-04-16; dashboard E2E is manual via Chrome DevTools MCP

---

## 7. Testing Tools

```
Backend (NestJS):    Jest (unit + integration), Supertest (API)
Dashboard (Next.js): Vitest (unit), Chrome DevTools MCP (manual QA) — no Playwright
Mobile (RN/Expo):    Jest + RN Testing Library, Maestro (E2E flows)
DB:                  Prisma migrate test + seed validation
Types:               tsc --noEmit (strict in each workspace)
Lint:                ESLint --max-warnings 0 + Prettier
QA source of truth:  Kiwi TCMS at https://localhost:6443 — Product = "Deqah" (id=1), Version = "main"
                     One TestPlan per (domain, type): e.g. "Deqah / Bookings / Manual QA"
                     Use the existing sync scripts — never write new ones:
                       · scripts/kiwi/kiwi-sync-manual-qa.mjs  (manual QA)
                       · /c/pro/kiwi-tcms/run-and-sync.sh (automated)
```

Coverage thresholds (backend): **40% branch, 50% fn/line** — enforce via `npm run test:cov`.

---

## 8. Entry Point (when Maestro is invoked)

Once you opt into Maestro for a task (via `/plan`, `/execute`, `/verify`, `/maestro`, or `/output-style maestro`):

1. **Yazid routes first** (~200 tokens, < $0.01)
2. Based on path, follow `docs/ai/PATHS.md`
3. Fahad never skips the Router *within a Maestro run* — no direct execution without a path
4. Fahad reports budget + cost at delivery

Outside a Maestro run, just use superpowers skills + plain feature branches as usual.

---

## 9. Escalation & Downgrade

Sometimes Yazid is wrong. Fahad adjusts mid-flight:

| Discovery | Action |
|-----------|--------|
| Task bigger than Yazid thought | Upgrade path (FAST → STANDARD → DEEP) |
| Schema change appears unexpectedly | Pull Rashed in |
| Owner-only module touched (payments, ZATCA, auth, migrations, schema, CODEOWNERS) | Pull Abdullah in |
| Task smaller than expected | Stay at current path, deliver fast |

**Downgrades are logged but don't require user approval. Upgrades exceeding 2× original budget require user approval.**

---

## 10. Ownership & Sensitivity Tiers

| Tier | Modules | Reviewer |
|------|---------|----------|
| **Owner-only** | `payments/` · `zatca/` · `auth/` · `prisma/` · schema changes · `CODEOWNERS` | Abdullah (mandatory) |
| **Standard** | Every other backend module, dashboard route, mobile flow | Fahad |

Any task touching Owner-only scope is automatically upgraded to DEEP by Fahad regardless of Yazid's initial routing.
