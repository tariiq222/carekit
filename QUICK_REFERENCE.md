# Quick Reference — Maestro v10 (CareKit)

## Models

```
claude-haiku-4-5-20251001   ← Yazid (router)
claude-opus-4-7             ← Fahad, Rashed, Abdullah
claude-sonnet-4-6           ← Everyone else
```

## Path Decision (Yazid's Output → Your Action)

| Router says | You do |
|-------------|--------|
| FAST | 1 agent, edit in place, ~$0.05 |
| STANDARD | 2–3 agents + Sultan scoped scan + feature branch + Kiwi sync, ~$0.50 |
| DEEP | Full team + Sultan full + worktree + security + Kiwi + retro, ~$5 |

## Budget Cheat Sheet

| Path | Tokens | Cost | Time |
|------|:------:|:----:|:----:|
| FAST | 5–15K | < $0.05 | < 1 min |
| STANDARD | 30–80K | $0.30–0.80 | 5–15 min |
| DEEP | 150–500K | $3–15 | 30min–2hr |

## Test Commands

### Backend (`apps/backend`)
```bash
npm run test --workspace=backend             # Jest unit
npm run test:e2e --workspace=backend         # Jest E2E (test/jest-e2e.json)
npm run test:cov --workspace=backend         # Coverage (40% branch, 50% fn/line)
npm run test:kiwi                            # Unit run → Kiwi TCMS
npm run test:kiwi:e2e                        # E2E run → Kiwi TCMS
npm run test:kiwi:all                        # Unit + E2E run → Kiwi TCMS
```

### Dashboard (`apps/dashboard`)
```bash
npm run test --workspace=dashboard           # Vitest
# E2E is manual via Chrome DevTools MCP — Playwright was removed 2026-04-16
```

### Mobile (`apps/mobile`)
```bash
npm run test --workspace=mobile              # Jest + jest-expo
maestro test apps/mobile/flows/              # Mobile E2E flows
```

### Manual QA → Kiwi
```bash
# After completing manual QA with Chrome DevTools MCP:
# 1. Write report to docs/superpowers/qa/<feature>-report-<date>.md
# 2. Author plan JSON at data/kiwi/<domain>-<date>.json
# 3. Run:
npm run kiwi:sync-manual data/kiwi/<domain>-<date>.json
```

## Type + Lint

```bash
npm run lint                                 # turbo run lint (all workspaces)
# Per-workspace typecheck:
npm run typecheck --workspace=dashboard      # tsc --noEmit
# Backend uses tsc via nest build — no separate typecheck script
```

## Worktree Commands (DEEP path)

```bash
# Create (from main workspace)
git worktree add ../carekit-feat-X -b feat/X main

# List
git worktree list

# Remove (after merge)
git worktree remove ../carekit-feat-X
git branch -d feat/X
```

Worktree ports: backend 5110, 5120, 5130 · dashboard 5113, 5123, 5133 · mobile 5112, 5122, 5132 · website 5114, 5124, 5134.

## Gate Matrix

| Gate | FAST | STANDARD | DEEP |
|------|:----:|:--------:|:----:|
| Type + Lint | ✅ | ✅ | ✅ |
| Unit tests | — | ✅ | ✅ |
| Integration | — | ✅ | ✅ |
| E2E (Maestro mobile / manual dashboard via Chrome DevTools MCP) | — | — | ✅ |
| Security review (Abdullah) | — | — | ✅ |
| Kiwi TCMS sync | — | ✅ | ✅ |
| Retrospective + Changelog (Omar) | — | — | ✅ |

## Agent → Path

| Agent | FAST | STANDARD | DEEP |
|-------|:----:|:--------:|:----:|
| Yazid (router) | ✅ | ✅ | ✅ |
| Fahad (orchestrator) | ✅ | ✅ | ✅ |
| Sultan (explorer) | — | ✅ (5K) | ✅ (20K) |
| Rashed (architect) | — | If schema | ✅ |
| Nawaf, Khaled, Salem, Majed, Badr | As needed | As needed | As needed |
| Saad (tester) | — | ✅ | ✅ |
| Abdullah (security) | — | If owner-only | ✅ |
| Turki (devops) | — | If infra/migration | ✅ |
| Omar (historian) | — | — | ✅ |

## Owner-only Modules (Abdullah required)

```
apps/backend/src/modules/payments/
apps/backend/src/modules/zatca/
apps/backend/src/modules/auth/
apps/backend/prisma/**               (schema + migrations)
CODEOWNERS
```

Any task touching these is auto-upgraded to DEEP.

## Delegation Template

```
Task(subagent_type: "general-purpose", prompt: `
  You are [agent] ([role]).
  Model: [Haiku | Sonnet | Opus]

  Path context: [FAST | STANDARD | DEEP]
  Task: [clear description]

  Context from Sultan: [key findings]

  Deliverables:
  1. [deliverable]
  2. [tests per gate matrix]

  Boundaries:
  - Files allowed: [scope]
  - Working directory: [main or ../carekit-feat-X worktree]
  - Budget: [tokens]

  CareKit rules:
  - Tenant scoping via \`organizationId\` read from \`TenantContextService\` (CLS); respect \`TENANT_ENFORCEMENT\` flag
  - 350-line max per file
  - Semantic tokens only (--primary, --accent) — no hex, no text-gray-*
  - RTL-first: ps-/pe-/ms-/me- only
  - i18n via next-intl (AR+EN)
  - Prisma migrations immutable; no \`prisma db push\`
  - Kiwi Product = "CareKit" only

  Output:
  - diff summary
  - test results
  - Kiwi run URL (if STANDARD+/DEEP)
  - tokens consumed
`)
```

## Escalation Rules

```
Sultan finds unexpected complexity → Upgrade path
Agent fails 2x on same subtask → Escalate to Opus
Prisma schema change appears → Pull Rashed
Owner-only module touched → Pull Abdullah
File > 350 lines appears in diff → Halt, ask for split
Hex color / text-gray-* in UI → Halt, replace with semantic token
Playwright import detected → Halt (Playwright removed 2026-04-16)
Budget at 80% → Alert user
Budget at 120% → Halt, save partial work
```

## Common Mistakes to Avoid

1. ❌ Starting execution without Yazid's routing decision
2. ❌ Running Sultan on FAST tasks (wastes tokens)
3. ❌ Full Sultan scan when scoped would do
4. ❌ Creating worktree for STANDARD tasks
5. ❌ Skipping budget tracking
6. ❌ Fahad writing code instead of delegating
7. ❌ Missing worktree cleanup after merge
8. ❌ Running migrations from worktree against main dev DB
9. ❌ E2E skipped on DEEP tasks
10. ❌ No changelog entry for DEEP delivery
11. ❌ Re-introducing Playwright (removed 2026-04-16)
12. ❌ Creating a second Kiwi Product (only `CareKit`)
13. ❌ Reading `organizationId` from request body — it must come from `TenantContextService` (CLS)
14. ❌ Using `pnpm` — the project is on `npm@11.6.2` via npm workspaces
