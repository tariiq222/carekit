# Deqah AI Engineering Runtime

> **Status:** Active — Kilo-Native Orchestration
> **Last Updated:** 2026-05-11
> **Architecture:** [ADR-002](./docs/ai/ADR-002-KILO-NATIVE-ORCHESTRATION.md)

---

## Philosophy

**Linear pipeline, role-specialized models.** The orchestrator delegates each stage to the cheapest model that can do the job well:

- **Opus 4.7** — Orchestrator + Planner (STANDARD path) + Validator (HIGH risk only)
- **Sonnet 4.6** — Risk Classifier, default Validator, Tests Analyzer, PR Author, Executor wrapper
- **MiniMax-M2.7-highspeed** — Heavy generative work inside Executor (called via `mmx` CLI)

Target token distribution: **10% Opus / 25% Sonnet / 65% MiniMax**.

---

## 1. Pipeline

```
Request
  ↓
Pre-classifier (deterministic — no LLM)
  ↓
Planner ─── Opus (STANDARD path)
          └ Sonnet (FAST path — single file, < 200 char, no danger keywords)
  ↓
Risk Classifier ─── Sonnet
  ↓
Execution Decision (deterministic)
  ├─ LOW/MEDIUM     → Auto Execute
  ├─ HIGH           → Human Approval → Auto Execute
  └─ blocking_patterns → BLOCKED
  ↓
Executor ─── Sonnet wrapper → MiniMax-M2.7 via `mmx text chat`
  ↓
Validator ─── Sonnet (default) → Opus (HIGH risk or low confidence)
  │  Step 1: deterministic — apps/runtime/src/audit/detector.ts
  │  Step 2: LLM review + sandbox checks (destructive/schema/deps)
  ↓
Tests ─── Bash (lint/typecheck/jest) → Sonnet Tests Analyzer (on failure)
  ↓
PR Author ─── Sonnet (git branch + commit + gh pr create)
  ↓
Staging Deploy ─── GitHub Actions (existing auto-promote.yml)
```

---

## 2. Running a Task

### From inside Kilo Code

```
/orchestrate "Add a /health endpoint to apps/backend with a tenant-scoped DB ping"
```

### Dry-run (Plan + Risk only)

```
/orchestrate --dry-run "Refactor finance/payments service to use the new Moyasar SDK"
```

### Resume an approved HIGH-risk task

```bash
# inspect the plan + risk
cat .kilo/orchestrator/pending/tsk_2026_05_11_001.md

# approve
touch .kilo/orchestrator/pending/tsk_2026_05_11_001.approved
```

```
/orchestrate --resume tsk_2026_05_11_001
```

---

## 3. Where the Agents Live

| Stage | File | Model |
|---|---|---|
| Slash command | `.kilo/command/orchestrate.md` | Opus (orchestrator) |
| Planner (STANDARD) | `.kilo/agent/deqah-planner.md` | Opus |
| Planner (FAST) | `.kilo/agent/deqah-planner-inline.md` | Sonnet |
| Risk Classifier | `.kilo/agent/deqah-risk-classifier.md` | Sonnet |
| Executor | `.kilo/agent/deqah-executor.md` | Sonnet → MiniMax |
| Validator (default) | `.kilo/agent/deqah-validator.md` | Sonnet |
| Validator (HIGH) | `.kilo/agent/deqah-validator-opus.md` | Opus |
| Tests Analyzer | `.kilo/agent/deqah-tests-analyzer.md` | Sonnet |
| PR Author | `.kilo/agent/deqah-pr-author.md` | Sonnet |
| Rescue (fallback) | `.kilo/agent/deqah-rescue.md` | Sonnet |

Runtime state: `.kilo/orchestrator/` (gitignored).

---

## 4. Risk Classification

A task is **HIGH** risk if any of these triggers fire (deterministic, no LLM needed):

- `touches.payments === true` (any file under `modules/finance/payments/**`)
- `touches.schema` or `touches.migrations === true`
- Any `affected_files` matches `**/migrations/**`
- `estimated_diff_lines > 300`
- Any file under `apps/backend/src/core/auth/`
- Files like `tenant-resolver.middleware.ts` or `prisma.service.ts`
- `description` contains `delete|drop|truncate|reset|destroy`

HIGH risk requires human approval. Other levels (LOW, MEDIUM) auto-execute.

---

## 5. Blocking Patterns (always blocked, even after approval)

- `rm -rf`
- `git push --force` / `git reset --hard`
- `prisma db push` (use migrations)
- Modifying an existing `migrations/*/migration.sql`
- Deleting `ActivityLog` / `SuperAdminActionLog` rows

Detected by the Risk Classifier and re-checked by the Validator.

---

## 6. Forbidden Code Patterns

Validator rejects diffs that introduce any of these:

- `: any` without justification comment
- `@ts-ignore` (use `@ts-expect-error` with issue link)
- `console.log` / `console.error` in production code
- Hardcoded secrets
- `SELECT *` raw queries
- N+1 queries
- UI text without i18n keys
- Missing RTL (left/right CSS) — use `start`/`end` logical properties
- Hex colors in code — use semantic tokens
- Magic numbers without `const`
- Commented-out code
- Files > 350 lines
- Editing existing migrations

---

## 7. Source of Truth

```
Git ──────────────▶ .kilo/orchestrator/tasks/<id>.json ──────────────▶ GitHub PR
(code + agents)     (execution state, gitignored)                      (review + deploy)
```

| Source | Responsibility |
|---|---|
| **Git** | Code, agent prompts, ADRs, CODEOWNERS, Prisma schemas |
| **`.kilo/orchestrator/`** | Per-task state, trace log, pending approvals (local only) |
| **GitHub PR + Actions** | Review, staging deploy, production promotion |

---

## 8. Trace & Audit

Every stage writes an event to `.kilo/orchestrator/trace.jsonl`:

```jsonl
{"ts":"2026-05-11T01:30:00Z","task_id":"tsk_...","stage":"planner","event":"completed","model":"opus","tokens":8123,"duration_ms":12000}
```

Query examples:

```bash
# all events for a task
grep '"task_id":"tsk_2026_05_11_001"' .kilo/orchestrator/trace.jsonl | jq .

# token usage by model today
jq -s '[.[] | select(.tokens) | { model, tokens }] | group_by(.model) | map({ model: .[0].model, total: (map(.tokens) | add) })' .kilo/orchestrator/trace.jsonl
```

---

## 9. Failure Handling

| Failure | Action |
|---|---|
| Executor (MiniMax) returns malformed patch | Retry once; if still bad → escalate to human |
| Executor produces files outside `affected_files` | Reject patch, force re-execution with feedback |
| Validator finds critical issues | Re-execute (max 3 retries) → escalate |
| Sonnet Validator returns `confidence: "low"` | Re-run Validator with Opus |
| Tests fail | Tests Analyzer decides: retry executor / rerun flaky / escalate |
| MiniMax CLI unreachable (auth/network) | Fall back to `deqah-rescue` (Sonnet) for the executor stage |
| Validator/Executor loop (same bad output 3× in a row) | Hand task + context to `deqah-rescue` |
| Kilo Anthropic provider unreachable (proxy or direct API) | Hard stop — orchestrator cannot proceed |

Max retries: Executor 2, Validator 3, Tests 2. After exhaustion → `status: "FAILED"`.

---

## 10. What Was Removed (from ADR-001)

The original ADR-001 design proposed Temporal + event bus + policy YAML + memory store + a separate Sandbox stage + an Orchestration Audit Agent + a 3-track state machine. **None of it was implemented in 6 months.** ADR-002 deletes those concepts in favor of:

- Linear pipeline (no event bus, no parallel stages)
- Sandbox merged into Validator
- Audit replaced by `grep | jq` on `trace.jsonl`
- State in JSON files (no Temporal, no Postgres)
- Risk rules in agent prompts + reused `apps/runtime/src/audit/detector.ts`

Full migration map: [ADR-002 §9](./docs/ai/ADR-002-KILO-NATIVE-ORCHESTRATION.md#9-migration-from-adr-001).

---

## 11. References

- **[ADR-002 — Kilo-Native Orchestration](./docs/ai/ADR-002-KILO-NATIVE-ORCHESTRATION.md)** (active)
- **[ADR-001 — Deqah Runtime Core](./docs/ai/ADR-001-DEQAH-RUNTIME-CORE.md)** (superseded, historical)
- **Global rules:** `~/.config/kilo/AGENTS.md` — Opus = orchestrator only, 10/25/65 token split
- **[Plan: Orchestration v2](./.kilo/plans/1778452249264-stellar-eagle.md)** — design rationale
