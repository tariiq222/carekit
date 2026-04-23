# MAESTRO.md — Maestro v10 Entry Point (CareKit edition)

CareKit uses **Maestro v10** — a tiered multi-agent system with a Planner-Verifier architecture that separates planning from code writing. This file is the orchestration entry; project specifics still live in `CLAUDE.md`.

## Three Ways to Activate Maestro

### 1. One-shot slash commands (most common)

```
/plan [task]        Planning phase only — writes IMPLEMENTATION_PLAN.md for external AI (Cursor/Copilot)
/execute [task]     Full cycle inside Claude Code (plan + delegate to agents + verify)
/verify [branch]    Verify code written by external AI
/maestro [task]     Interactive — asks you to pick PLAN/EXECUTE/VERIFY
```

**Key difference:** `/plan` stops after planning (user implements elsewhere). `/execute` continues with agent team to write code.

### 2. Persistent output style (mode-like)

```
/output-style maestro
```

Every request in the session routes through Maestro until you exit with `/output-style default`.

### 3. Subagent call (from outside)

If you're not using Maestro globally but want it for one task:

```
@maestro plan the waitlist feature
```

## Quick Decision: Which Command?

```
Want a plan to hand to Cursor/Copilot?           → /plan (stops after planning)
Want Claude Code agents to implement?            → /execute (plan + agents + verify)
External AI finished, want audit?                → /verify
Not sure, let Claude Code ask?                   → /maestro (interactive)
Want Maestro active for whole session?           → /output-style maestro
```

**Key:** `/plan` is for **planning only** — Fahad writes IMPLEMENTATION_PLAN.md and stops. `/execute` continues with the agent team to write code.

## Mandatory Reading Order (for Claude)

1. `CLAUDE.md` — CareKit project rules, stack, domain map, design law
2. `AGENTS.md` — agent roster + flow (Maestro v10)
3. `PATHS.md` — path playbook (FAST/STANDARD/DEEP) with CareKit scripts
4. `WORKTREES.md` — git worktree policy for DEEP tasks (carekit_ DB prefix, ports 5110+)
5. `.claude/commands/maestro.md` — master command with templates

## Models

- **Orchestration + Architecture + Security:** `claude-opus-4-7` (Fahad, Rashed, Abdullah)
- **Execution + Testing + Docs + Discovery:** `claude-sonnet-4-6` (all others)
- **Routing:** `claude-haiku-4-5-20251001` (Yazid — lightweight classification)

## The Five Verification Layers

When verifying any work (auto-run on /execute, manual via /verify):

| Layer | Trust | What it catches |
|-------|:-----:|-----------------|
| 1. Determinism (tsc/eslint/tests) | 100% | Type errors, lint, failing tests |
| 2. Plan adherence (git diff stat) | 95% | Scope creep, missing files |
| 3. Diff review (Sultan reads diff) | 85% | Anti-patterns, convention breaks |
| 4. Behavioral tests (Saad) | 90% | Missing or wrong test coverage → Kiwi TCMS |
| 5. Manual UX check (you) | 100% | Visual bugs, RTL, Chrome DevTools MCP walk-through |

## Unbreakable Rules (CareKit-specific overlay)

1. Every code task goes through Yazid's routing first — no direct execution
2. Claude Code never writes code in PLAN_ONLY mode
3. Verification uses real `npm run …` / `turbo run …` commands, not guesses
4. DEEP tasks **suggest** a worktree but don't force
5. Budget reported at end of every task (advisory, no hard caps)
6. Tenant scoping via **`organizationId`** — read from `TenantContextService` (CLS-backed, `apps/backend/src/common/tenant/`). Never read tenant id from request body. Honor the `TENANT_ENFORCEMENT` feature flag (dormant during SaaS Plan 01 rollout, strangler pattern)
7. Ports 5000–5999 only; worktree ports start at 5110 (see `WORKTREES.md`)
8. File length ≤ 350 lines; split before you cross
9. Prisma migrations are immutable — never `prisma db push`, never manual SQL
10. All UI strings behind i18n keys (next-intl, AR/EN); RTL-first with logical properties (`ps-`/`pe-`/`ms-`/`me-`)
11. Kiwi TCMS is the single source of truth for test results — one Product (`CareKit`), distinguish by Category + Plan type

## Agent Quick Reference

| Agent | Arabic | Model | When |
|-------|--------|-------|------|
| router | Yazid | Haiku 4.5 | Every request |
| maestro | Fahad | Opus 4.7 | All paths |
| explorer | Sultan | Sonnet 4.6 | STANDARD, DEEP |
| architect | Rashed | Opus 4.7 | DEEP with schema |
| backend | Nawaf | Sonnet 4.6 | Execute paths (NestJS 11 + Prisma 7) |
| frontend | Khaled | Sonnet 4.6 | Execute paths (Next.js 15 / RN 0.83) |
| tester | Saad | Sonnet 4.6 | STANDARD, DEEP (Kiwi-synced) |
| type-checker | Majed | Sonnet 4.6 | All paths |
| security | Abdullah | Opus 4.7 | DEEP audit + Owner-only tiers |
| refactor | Badr | Sonnet 4.6 | STANDARD, DEEP |
| docs | Salem | Sonnet 4.6 | All paths |
| devops | Turki | Sonnet 4.6 | STANDARD, DEEP |
| historian | Omar | Sonnet 4.6 | DEEP only |

## Ownership Tiers (from CLAUDE.md)

- **Owner-only** (`@tariq`): payments, ZATCA, auth, migrations, schema, CODEOWNERS → must pass Abdullah
- **Standard review**: every other module

## Handoff Contract

- PLAN_ONLY mode writes `IMPLEMENTATION_PLAN.md` + `TEST_CASES.md` at repo root
- VERIFY mode writes `VERIFICATION_REPORT.md` at repo root
- These files are the handoff surface — they must stand on their own for an external AI
