# Orchestration Team Redesign — GLM-First, Sonnet Reviews

**Date:** 2026-04-09  
**Status:** Approved  
**Scope:** CLAUDE.md (global) — applies to CareKit, Bawsala, Adeer, and all future projects

---

## Context

The current Maestro v5.0 orchestration in `~/.claude/CLAUDE.md` has GLM rules that are inconsistently enforced:
- GLM has listed exceptions that allow Sonnet to write code directly without justification
- No automated validation step between code generation and review
- Reviewer has no path to flag a broken plan (only code retries)
- "CareKit patterns" hardcoded — not generic across projects
- Intent Gate missing branches for docs-only, config-change, migration, and out-of-scope

This redesign fixes all of the above.

---

## Team: 4 Members, 3 Roles

| Arabic Name | Role | Model | Status Label |
|-------------|------|-------|--------------|
| 🧠 فهد | Lead / Planner | Claude Sonnet 4 | جاري التحليل... |
| ⚡ راشد | Coder | GLM 5.1 (via `/usr/local/bin/glm`) | جاري الكتابة... |
| 🔍 نواف | Validator | Automated (tsc + eslint + jest) | جاري الفحص... |
| 👁 خالد | Reviewer | Claude Sonnet 4 | جاري المراجعة... |

> **Note:** GLM 5.1 is the custom model configured via `ANTHROPIC_DEFAULT_HAIKU_MODEL=glm-5.1`.
> All references to "haiku" in prompts or labels are replaced with "glm".
> فهد and خالد run on the same Sonnet 4 instance but in distinct phases with distinct responsibilities.

---

## Full Pipeline

### Step 0 — Context Scan (فهد)

Before the Intent Gate, فهد always reads:
- Project type (monorepo / single app)
- Active `CLAUDE.md` files (root + app-level)
- Last 5 git commits (`git log --oneline -5`)
- Tech stack (derived from CLAUDE.md — not re-explored each time if already in context)
- Which project is active: CareKit / Bawsala / Adeer / other

Output: internal context object passed to all subsequent steps.

---

### Step 1 — Intent Gate (فهد)

| Intent Type | Path | Notes |
|-------------|------|-------|
| `feature` | Full Pipeline | — |
| `bug` | Full Pipeline | — |
| `refactor` | Full Pipeline | — |
| `migration` | Full Pipeline | Immutable rule enforced by راشد |
| `test` | Full Pipeline | — |
| `config-change` | Full Pipeline | Config files are code — راشد writes them |
| `docs-only` | Fast-Track | فهد writes directly, no GLM |
| `string / label / style / className` | Fast-Track | فهد writes directly, no GLM |
| `question / research / explanation` | Direct Answer | No code path, STOP after response |
| `ambiguous HIGH` | Ask User | One question only, STOP |
| `out-of-scope` | Reject | Explain why, suggest alternative |

**Fast-Track** skips راشد, نواف, and خالد entirely — فهد delivers directly.

**Output of Intent Gate:** classified type + detailed plan + full prompt for راشد (includes: task description, file paths, expected output, project patterns reference).

---

### Step 2 — راشد [المبرمج — GLM 5.1]

**Status label:** `⚡ راشد — جاري الكتابة...`

**Rules:**
- GLM is **mandatory** — no exceptions based on task size or "simplicity"
- Invoked via: `glm "<full prompt with context>"`
- Must produce: strict TypeScript, no `any`, no commented-out code
- Must respect 350-line rule (see below)
- Migration files must be additive only — never modify existing ones

**The ONLY exceptions (راشد is skipped):**
1. GLM returns timeout or empty response
2. GLM produces incorrect/broken code twice in a row (×2)

In both cases: فهد writes directly + logs reason as `GLM_SKIP: <reason>` in the delivery summary.

**350-Line Rule:**

| File Type | Limit | Notes |
|-----------|-------|-------|
| Regular source files | 350 lines max | Split immediately when approaching |
| Test files (`*.spec.ts`) | 500 lines max | Test suites grow naturally |
| Prisma migrations | No limit | Immutable — never touched |
| Generated types / schemas | No limit | Auto-generated — never edited manually |
| Translation JSON files | No limit | Data, not code |
| Config files (`tsconfig.json`, `docker-compose.yml`, `nginx.conf`, `*.config.*`) | No limit | Infrastructure config — not application code |

If a file approaches the limit, راشد splits it **before** passing to نواف — not after review.

---

### Step 3 — نواف [المدقق — Automated]

**Status label:** `🔍 نواف — جاري الفحص...`

Runs three checks in order:

```bash
# 1. TypeScript compile
npx tsc --noEmit

# 2. Lint
npm run lint

# 3. Tests (affected files only)
npm run test -- --testPathPattern="<changed-files>"
```

**Results:**

| Result | Action |
|--------|--------|
| All pass | Forward to خالد |
| Any fail | Return to راشد with exact error output (max 2 retries) |
| Fail ×2 | STOP — فهد reports to user with full error log |

نواف never interprets errors — it passes them verbatim to راشد.

---

### Step 4 — خالد [المراجع — Sonnet 4]

**Status label:** `👁 خالد — جاري المراجعة...`

Reviews 5 dimensions, each scored /10:

| Dimension | What it checks |
|-----------|---------------|
| منطق الكود | Logic correctness, edge cases, no silent failures |
| تنظيم + حجم | File size, single responsibility, no tangled imports |
| TypeScript strictness | No `any`, correct types, no type assertions without justification |
| Project patterns | Loaded from root `CLAUDE.md` + active app `CLAUDE.md` (generic — works across all projects) |
| أمان | No injection, no exposed secrets, no unvalidated external input |

**Scoring:**

| Score | Decision | Action |
|-------|----------|--------|
| ≥ 7/10 | PASS | Forward to فهد for delivery |
| 5–6/10 | PASS + tech debt note | Deliver with note logged |
| ≤ 4/10 | FAIL | Classify failure type (see below) |

**Failure Classification & Retry Budget:**

```
Retry budget (separate pools):
  CODE_ISSUE retries: max 2   (cheap — راشد rewrites only)
  PLAN_ISSUE retries: max 1   (expensive — فهد replans + راشد rewrites)
  Total max retries:  3

Retry 1 (any type):
  خالد classifies → CODE_ISSUE or PLAN_ISSUE
  CODE_ISSUE → راشد rewrites with خالد's notes
  PLAN_ISSUE → فهد replans → راشد rewrites

Retry 2 (code only):
  If first CODE retry also fails → Opus is called to re-classify
  Opus decides: is this actually a PLAN_ISSUE misclassified by خالد?
    YES → فهد replans (uses the 1 PLAN retry budget)
    NO  → راشد gets one final rewrite with Opus's diagnosis
  If first PLAN retry fails → STOP, report to user (PLAN budget exhausted)

Retry 3 (code only, post-Opus):
  راشد final rewrite based on Opus diagnosis
  If still fails → STOP, full context to user
```

**Why Opus on retry 2:**
خالد (Sonnet) can misclassify — sending a PLAN_ISSUE as CODE causes راشد to
rewrite the same broken logic twice, burning both retries. Opus at the pivot
point costs more but prevents wasted cycles and surfaces the real root cause.

خالد cannot change code directly. خالد cannot write code. خالد only judges.

---

### Step 5 — فهد [Delivery]

**Status label:** `🧠 فهد — جاري التسليم...`

Outputs Maestro Delivery Summary:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Maestro v5.0 — Task Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Task: [one line]
Project: [CareKit / Bawsala / Adeer / other]
Intent: [feature / bug / refactor / ...]
Size: [S/M/L/XL]
Gate level: [fast-track / full-pipeline]

Files changed:
  - [file]: [what changed]

Agent summary:
  - راشد: [one line — what was written]
  - نواف: [PASS / FAIL×N]
  - خالد: [score] — [PASS / PASS+debt / FAIL→retry]

GLM_SKIP: [reason if راشد was bypassed, else "none"]
Tech debt: [if any]
Side issues: [if any — "address in separate task"]
```

---

## Feedback Loop Diagram

```
فهد [Lead]
  ↓ plans + writes GLM prompt
راشد [Coder — GLM]
  ↓ writes code
نواف [Validator — auto]
  ↓ compile + lint + test
خالد [Reviewer — Sonnet]
  ↓
  ├── PASS → فهد [Delivery]
  │
  ├── FAIL retry 1:
  │     خالد classifies →
  │       CODE_ISSUE → راشد rewrites (code retries: 1/2)
  │       PLAN_ISSUE → فهد replans → راشد rewrites (plan retries: 1/1)
  │
  └── FAIL retry 2:
        [CODE path only — PLAN budget exhausted after 1]
        Opus re-classifies خالد's diagnosis →
          Still CODE → راشد final rewrite (code retries: 2/2)
          Actually PLAN → فهد replans → راشد rewrites (uses plan budget: 1/1)
        If still fails → STOP, full context to user
```

---

## Circuit Breakers

| Trigger | Action |
|---------|--------|
| Same error 3× | Force strategy change, report to user |
| نواف fails ×2 | STOP, full error to user |
| خالد FAIL ×2 | STOP, full context to user |
| GLM timeout | Skip once, log GLM_SKIP, فهد writes |
| S>5m / M>15m / L>30m / XL>50m | STOP, report, ask user |

---

## Project Pattern Loading (Generic)

خالد always loads patterns from (in priority order):
1. `~/.claude/CLAUDE.md` — global rules (Maestro protocol, Golden Rules)
2. `[project-root]/CLAUDE.md` — project-specific rules
3. `[project-root]/[app]/CLAUDE.md` — app-level rules (backend, dashboard, mobile)

**Fallback when app/CLAUDE.md is missing:**
- خالد falls back to root CLAUDE.md only
- فهد logs a warning in the delivery summary:

```
WARNING: No app-level CLAUDE.md found for [app-name].
         Reviewer applied root rules only.
         Recommendation: create [app]/CLAUDE.md with module-specific conventions.
```

This makes خالد work correctly across all projects without hardcoding CareKit-specific references.

---

## What Each Agent Must NEVER Do

| Agent | Forbidden |
|-------|-----------|
| فهد | Write code (except fast-track) |
| راشد | Review code / judge quality |
| نواف | Interpret errors / make decisions |
| خالد | Write or modify code |
