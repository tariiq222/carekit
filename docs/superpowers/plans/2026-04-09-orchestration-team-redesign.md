# Orchestration Team Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Maestro v5.0 orchestration section in `~/.claude/CLAUDE.md` with the new 4-agent GLM-first model (فهد → راشد → نواف → خالد).

**Architecture:** Single-file edit — `~/.claude/CLAUDE.md`. The Maestro section (lines 1–197) is fully replaced. The Global Rules section (lines 200–281) is preserved with one targeted update to the 350-line rule exceptions list.

**Tech Stack:** Markdown, Claude Code Edit tool

---

## Files

| Action | File | What changes |
|--------|------|--------------|
| Modify | `~/.claude/CLAUDE.md` lines 1–197 | Full Maestro section replacement |
| Modify | `~/.claude/CLAUDE.md` line 211 | 350-line rule — add exceptions list |

---

### Task 1: Backup current CLAUDE.md

- [ ] **Step 1: Create a backup**

```bash
cp ~/.claude/CLAUDE.md ~/.claude/CLAUDE.md.bak-2026-04-09
```

- [ ] **Step 2: Verify backup exists**

```bash
ls -la ~/.claude/CLAUDE.md.bak-2026-04-09
```

Expected: file exists with same size as original.

---

### Task 2: Replace Maestro section header and Model Labels

Replace lines 1–18 (from `## Maestro v5.0` through the closing example block).

- [ ] **Step 1: Edit — replace header and labels**

Old content (exact match):
```
## Maestro v5.0 — Orchestration Protocol (Global, All Projects)

> This is the primary interface layer. Every task routes through Maestro before any action is taken.

### Model Label (REQUIRED before every action)

Before every step you take, print one line identifying yourself:
- Thinking / planning / coordinating → `🧠 Claude Sonnet`
- Deep analysis / critical review → `👁 Claude Opus`
- GLM tools handle their own labels automatically

Example:
```
🧠 Claude Sonnet — تحليل المهمة
🎨 GLM 5.1 [Frontend] — يكتب الكود
🧠 Claude Sonnet — مراجعة النتيجة
```
```

New content:
```
## Maestro v6.0 — Orchestration Protocol (Global, All Projects)

> This is the primary interface layer. Every task routes through Maestro before any action is taken.

### Agent Team

| Agent | Arabic Name | Model | Status Label |
|-------|-------------|-------|--------------|
| Lead / Planner | 🧠 فهد | Claude Sonnet 4 | جاري التحليل... |
| Coder | ⚡ راشد | GLM 5.1 (`/Users/tariq/.local/bin/glm`) | جاري الكتابة... |
| Validator | 🔍 نواف | Automated (tsc + eslint + jest) | جاري الفحص... |
| Reviewer | 👁 خالد | Claude Sonnet 4 | جاري المراجعة... |

> GLM 5.1 = `ANTHROPIC_DEFAULT_HAIKU_MODEL=glm-5.1`. Never refer to it as "haiku".
> فهد and خالد are the same Sonnet 4 instance — different phases, distinct responsibilities.

### Model Label (REQUIRED before every action)

Print one line before each step:
- فهد planning/coordinating → `🧠 فهد —`
- راشد writing code → `⚡ راشد —`
- نواف validating → `🔍 نواف —`
- خالد reviewing → `👁 خالد —`
- Opus deep analysis → `👁 Claude Opus —`
```

- [ ] **Step 2: Verify the edit looks correct**

Read lines 1–35 of `~/.claude/CLAUDE.md` and confirm the new header and team table are present.

---

### Task 3: Replace The Loop diagram and Steps 1–3

Replace lines 19–68 (The Loop + Intent Gate + Classify sections) with the new pipeline.

- [ ] **Step 1: Edit — replace The Loop + old Intent Gate + Classify**

Old content to remove (exact match from `### The Loop — 9 Steps` through `If risk = critical → STOP. Show reasoning to user. Wait for approval.`).

New content:
```markdown
### The Pipeline — 6 Steps

```
REQUEST
  ↓
0. CONTEXT SCAN      read CLAUDE.md + git log — always
  ↓
1. INTENT GATE       classify → route → plan
  ↓ (fast-track or full pipeline)
2. راشد [GLM]        write all code — mandatory
  ↓
3. نواف [AUTO]       tsc + lint + test
  ↓
4. خالد [REVIEW]     score /10 → PASS / FAIL / retry
  ↓
5. DELIVERY          فهد delivers Maestro summary
```

### Step 0 — Context Scan (فهد — جاري التحليل...)

Always runs first, before Intent Gate:
- Project type (monorepo / single app)
- Root `CLAUDE.md` + active app `CLAUDE.md` (backend / dashboard / mobile)
- Last 5 commits: `git log --oneline -5`
- Which project: CareKit / Bawsala / Adeer / other
- Tech stack (from CLAUDE.md — not re-explored if already in context)

### Step 1 — Intent Gate (فهد — جاري التحليل...)

| Intent | Path | Notes |
|--------|------|-------|
| `feature` | Full Pipeline | — |
| `bug` | Full Pipeline | — |
| `refactor` | Full Pipeline | — |
| `migration` | Full Pipeline | Additive only — راشد enforces |
| `test` | Full Pipeline | — |
| `config-change` | Full Pipeline | Config is code — راشد writes it |
| `docs-only` | Fast-Track | فهد writes directly, no راشد |
| `string / label / style / className` | Fast-Track | فهد writes directly, no راشد |
| `question / research / explanation` | Direct Answer | STOP after response |
| `ambiguous HIGH` | Ask User | One question only, STOP |
| `out-of-scope` | Reject | Explain why, suggest alternative |

Ambiguity rule:
- LOW → proceed, log assumptions
- MEDIUM + low risk → proceed, log assumptions
- MEDIUM + high risk → ask ONE question
- HIGH → STOP, ask user

**Fast-Track** skips راشد, نواف, خالد — فهد delivers directly.

**Intent Gate output:** intent type + size (S/M/L/XL) + full prompt for راشد
(includes: task description, file paths, expected output, project patterns reference).

Size classification:
| Size | Files |
|------|-------|
| S | 1–2 files |
| M | 3–5 files |
| L | 6–10 files |
| XL | 10+ files |

If risk = critical → STOP. Show reasoning to user. Wait for approval.
```

- [ ] **Step 2: Verify**

Read the updated section and confirm the pipeline diagram and Intent Gate table are correct.

---

### Task 4: Replace GLM section with راشد rules

Remove the old `### MANDATORY: GLM Writes All Code` and `### MANDATORY: When to Use GLM vs Claude Directly` sections. Replace with راشد's rules.

- [ ] **Step 1: Edit — replace both GLM sections**

Old content to remove (from `### MANDATORY: GLM Writes All Code` through `If in doubt → use GLM. Speed is not a reason to skip it.`).

New content:
```markdown
### Step 2 — راشد [المبرمج — GLM 5.1] (⚡ راشد — جاري الكتابة...)

**GLM is mandatory. No exceptions based on task size, "simplicity", or speed.**

Invoked via Bash: `glm "<full prompt with context, file paths, expected output>"`

Rules راشد must follow:
- Strict TypeScript — no `any`, no type assertions without justification
- 350-line max per file (split before passing to نواف, not after review)
- Migration files: additive only — never modify existing ones
- No commented-out code

**350-Line Rule — Exceptions (no limit applies):**
| File Type | Reason |
|-----------|--------|
| Prisma migrations | Immutable — never touched |
| Generated types / schemas | Auto-generated — never edited manually |
| Translation JSON (`*.json`) | Data, not code |
| Test files (`*.spec.ts`) | Max 500 lines |
| Config files (`tsconfig.json`, `docker-compose.yml`, `nginx.conf`, `*.config.*`) | Infrastructure, not application code |

**راشد is skipped ONLY when:**
1. GLM returns timeout or empty response
2. GLM produces broken/incorrect code on retry ×2

In both cases: فهد writes directly + logs `GLM_SKIP: <reason>` in delivery summary.
```

- [ ] **Step 2: Verify**

Confirm راشد's section exists and old GLM sections are gone.

---

### Task 5: Replace Execution Order and Gate Layer with نواف and خالد

Remove `### Step 6 — Execution Order` and `### Step 8 — Gate Layer`. Replace with نواف and خالد sections.

- [ ] **Step 1: Edit — replace Steps 6 and 8**

Old content to remove (from `### Step 6 — Execution Order` through `Score ≥7 → PASS. Score 5-6 → PASS + tech debt note. Score ≤4 → FAIL → SELF_CORRECT.`).

New content:
```markdown
### Step 3 — نواف [المدقق — Automated] (🔍 نواف — جاري الفحص...)

Runs in order — stops at first failure:

```bash
# 1. TypeScript compile
npx tsc --noEmit

# 2. Lint
npm run lint

# 3. Unit tests (affected files only)
npm run test -- --testPathPattern="<changed-files>"
```

| Result | Action |
|--------|--------|
| All pass | Forward to خالد |
| Any fail | Return to راشد with exact error output (retry, max 2) |
| Fail ×2 | STOP — فهد reports full error log to user |

نواف never interprets errors — passes them verbatim to راشد.

### Step 4 — خالد [المراجع — Sonnet 4] (👁 خالد — جاري المراجعة...)

Reviews 5 dimensions, each /10:

| Dimension | What it checks |
|-----------|----------------|
| منطق الكود | Logic correctness, edge cases, no silent failures |
| تنظيم + حجم | File size, single responsibility, no tangled imports |
| TypeScript strictness | No `any`, correct types, no unjustified assertions |
| Project patterns | Root CLAUDE.md + active app CLAUDE.md (generic across all projects) |
| أمان | No injection, no exposed secrets, no unvalidated external input |

**Scoring:**
| Score | Decision | Action |
|-------|----------|--------|
| ≥ 7/10 | PASS | Forward to فهد for delivery |
| 5–6/10 | PASS + tech debt | Deliver with note |
| ≤ 4/10 | FAIL | Classify → retry |

**Retry budget (separate pools):**
- CODE retries: max 2 (cheap — راشد rewrites only)
- PLAN retries: max 1 (expensive — فهد replans + راشد rewrites)
- Total max: 3

**Retry flow:**
```
Retry 1:
  خالد classifies:
    CODE_ISSUE → راشد rewrites with خالد's notes   (code: 1/2)
    PLAN_ISSUE → فهد replans → راشد rewrites        (plan: 1/1)

Retry 2 (code path only — plan budget exhausted after 1):
  Opus re-classifies خالد's diagnosis:
    Still CODE → راشد final rewrite                  (code: 2/2)
    Actually PLAN → فهد replans → راشد rewrites      (plan: 1/1)
  If PLAN retry already used → STOP, report to user

Retry 3 (code only, post-Opus):
  راشد final rewrite based on Opus diagnosis
  If still fails → STOP, full context to user
```

Why Opus on retry 2: خالد (Sonnet) can misclassify CODE vs PLAN.
Sending a PLAN_ISSUE as CODE burns both retries on rewriting the same broken logic.
Opus at the pivot costs more but surfaces the real root cause.

**Project pattern loading:**
1. `~/.claude/CLAUDE.md` — global rules
2. `[project-root]/CLAUDE.md` — project rules
3. `[project-root]/[app]/CLAUDE.md` — app rules (backend/dashboard/mobile)

Fallback if app CLAUDE.md missing: use root only + warn in delivery:
`WARNING: No app-level CLAUDE.md for [app]. Reviewer used root rules only.`

خالد never writes or modifies code. خالد only judges.
```

- [ ] **Step 2: Verify**

Confirm نواف and خالد sections are present, old Step 6 and Step 8 sections are gone.

---

### Task 6: Replace Delivery Format

Replace old `### Delivery Format` section.

- [ ] **Step 1: Edit — replace delivery format**

Old content (from `### Delivery Format` through closing triple-backtick of the format block).

New content:
```markdown
### Step 5 — Delivery (🧠 فهد — جاري التسليم...)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Maestro v6.0 — Task Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Task: [one line]
Project: [CareKit / Bawsala / Adeer / other]
Intent: [feature / bug / refactor / migration / test / config-change]
Size: [S/M/L/XL]   Gate: [fast-track / full-pipeline]

Files changed:
  - [file]: [what changed]

Agent summary:
  - راشد: [what was written — one line]
  - نواف: [PASS / FAIL×N]
  - خالد: [score/10] — [PASS / PASS+debt / FAIL→retry]

GLM_SKIP: [reason if راشد was bypassed, else "none"]
Tech debt: [if any]
Side issues: [if any — address in separate task]
WARNING: [app CLAUDE.md missing — if applicable]
```
```

- [ ] **Step 2: Verify**

Read updated delivery section and confirm it matches the spec format.

---

### Task 7: Update Circuit Breakers and Anti-Patterns

- [ ] **Step 1: Edit — update Circuit Breakers**

Old content (from `### Circuit Breakers` through `| Token 80% + <70% done | PAUSE, ask user |`).

New content:
```markdown
### Circuit Breakers

| Trigger | Action |
|---------|--------|
| Same error 3× | Force strategy change, report to user |
| نواف fails ×2 | STOP, full error log to user |
| خالد FAIL ×3 total retries exhausted | STOP, full context to user |
| GLM timeout | Skip once, log GLM_SKIP, فهد writes |
| S>5m / M>15m / L>30m / XL>50m | STOP, report, ask user |
| Token 80% + <70% done | PAUSE, ask user |
```

- [ ] **Step 2: Edit — update Anti-Patterns**

Old content (from `### Anti-Patterns — Never Do These` through `10. RAG save skipped — mandatory, blocks delivery`).

New content:
```markdown
### Anti-Patterns — Never Do These

1. Skip Context Scan — always runs before Intent Gate
2. Skip Intent Gate — always runs first
3. راشد skipped without logging GLM_SKIP — mandatory
4. فهد writes code outside fast-track — forbidden
5. خالد writes or modifies code — forbidden
6. نواف interprets errors — verbatim only
7. Loop on same error — max retries then circuit break
8. Pre-load all agents — lazy load per step
9. Keep full agent output — prune to ≤200 tokens
10. >5 files in one batch edit — split sequentially
11. Self-correct beyond failing scope — SCOPE LOCK enforced
12. Act on side issues during current task — log only
13. Arabic prompts to sub-agents — English only internally
14. RAG save skipped — mandatory, blocks delivery
```

- [ ] **Step 3: Verify**

Read the updated circuit breakers and anti-patterns sections.

---

### Task 8: Update 350-line rule in Global Rules

The Global Rules section (preserved) has a single-line 350 rule. Update it to reference exceptions.

- [ ] **Step 1: Edit — update the 350 line in Code Quality**

Old:
```
- Every file: 350 lines max. If approaching limit, split immediately.
```

New:
```
- Every file: 350 lines max. If approaching limit, split immediately.
  Exceptions (no limit): Prisma migrations, generated types, translation JSON,
  test files (max 500), config files (tsconfig, docker-compose, nginx, *.config.*).
```

- [ ] **Step 2: Verify**

Read the Code Quality section and confirm the exceptions are present.

---

### Task 9: Final verification

- [ ] **Step 1: Read the full updated CLAUDE.md**

Read `~/.claude/CLAUDE.md` from line 1 to end. Confirm:
- [ ] Header says "Maestro v6.0"
- [ ] Agent team table is present (فهد, راشد, نواف, خالد)
- [ ] Context Scan step exists
- [ ] Intent Gate has all 11 branches
- [ ] راشد section — GLM mandatory, 350-line exceptions table
- [ ] نواف section — tsc + lint + test
- [ ] خالد section — 5 dimensions, retry budget, Opus on retry 2, pattern fallback
- [ ] Delivery format has Project + GLM_SKIP + WARNING fields
- [ ] Circuit breakers updated
- [ ] Anti-patterns updated (14 items)
- [ ] Global Rules preserved intact
- [ ] 350-line rule in Global Rules has exceptions note

- [ ] **Step 2: Delete backup if satisfied**

```bash
rm ~/.claude/CLAUDE.md.bak-2026-04-09
```

Or keep it for one session as rollback insurance.

---

## Rollback

If anything breaks:
```bash
cp ~/.claude/CLAUDE.md.bak-2026-04-09 ~/.claude/CLAUDE.md
```
