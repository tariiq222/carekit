# CareKit — OpenCode AI Workflow System

Complete documentation of the multi-agent AI development system built for CareKit.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [What CTO Does on First Message](#2-what-cto-does-on-first-message)
3. [Architecture — The Six Agents](#3-architecture--the-six-agents)
4. [Workflow — Step by Step](#4-workflow--step-by-step)
5. [Session Model](#5-session-model)
6. [Commands — /نوقف and /نكمل](#6-commands)
7. [Task State File](#7-task-state-file)
8. [Pipelines](#8-pipelines)
9. [Token Optimization](#9-token-optimization)
10. [Daily Usage Guide](#10-daily-usage-guide)
11. [Full Example — Bug Fix Scenario](#11-full-example--bug-fix-scenario)
12. [Key Design Decisions](#12-key-design-decisions)
13. [Design System Governance](#13-design-system-governance)
14. [Limitations and Notes](#14-limitations-and-notes)
15. [File Map](#15-file-map)

---

## 1. System Overview

### What this system is

An AI-assisted development workflow built on top of OpenCode, specialized for CareKit. Instead of asking the AI to "just do it", every task is routed through a structured pipeline of specialized agents — each with a defined role, defined inputs, and defined outputs.

### Why CareKit needs this

CareKit is a large, multi-surface monorepo:
- **Backend** — 30+ NestJS modules
- **Dashboard** — Next.js App Router (RTL, Arabic-first)
- **Mobile** — Expo React Native (patient + practitioner apps)
- **Database** — PostgreSQL with Prisma, split schemas, immutable migrations

The core business is appointment scheduling. Bugs in booking logic can break clinic operations directly. A mistake in a migration can corrupt real patient records. A skipped auth guard can expose financial data.

A simple "write code and ship" approach is not safe at this scale and with this sensitivity. The system enforces:
- Structured analysis before any code is written
- Mandatory tests for every change
- Strict review before delivery
- Production risk simulation before merge
- Persistent memory so decisions aren't repeated

### How it works at a high level

```
User Request
     ↓
   CTO (orchestrator)
     ↓
Classifies session type and task type
     ↓
Routes to correct agent
     ↓
Pipeline executes stage by stage
     ↓
Lessons saved to memory
     ↓
Ready to commit
```

---

## 2. What CTO Does on First Message

Every session starts here. CTO reads the first message and makes one decision before anything else happens.

### Decision table

| First message | Session type | Action |
|---------------|-------------|--------|
| `/نكمل` | Resume | Read `current-task.json` → follow `نكمل.md` |
| `/نوقف` | Pause | Write `current-task.json` → stop |
| Question — "كيف يعمل X", "explain Y", "what is Z" | Direct answer | Answer immediately — no pipeline |
| Review request — "راجع هذا الكود", "review this diff" | Review-only | `review-diff` pipeline only |
| Test request — "اكتب اختبارات لـ X" | Test-only | `write-tests` pipeline only |
| Feature — "ابني X", "add X", "implement X" | New task | `analyze-task → implement → test → review → qa` |
| Bug — "اصلح X", "fix error in Y", "bug في Z" | New task | `analyze-task → implement → test → review → qa` |
| Refactor — "حسّن X", "restructure X", "clean up Y" | New task | `analyze-task → implement → test → review → qa` |
| Schema/DB — "add column", "اضف جدول", "migration for X" | New task (HIGH risk) | `analyze-task` with forced HIGH risk |
| UI/Design — "صمم صفحة X", "اختار palette", "new component" | New task (UI path) | `ui-ux-pro-max → carekit-ds → implement → review` |

### What CTO does NOT do on first message

- Does not load `current-task.json` unless first message is exactly `/نكمل`
- Does not infer continuation from topic or phrasing — there is no "this sounds like before"
- Does not start multiple pipelines — classifies into exactly one route
- Does not ask "is this a new task or a continuation?" — it decides based on the first message alone

### Classification order

When the first message is ambiguous, CTO resolves in this priority order:

```
1. Is it /نكمل?         → Resume (stop here)
2. Is it /نوقف?         → Pause (stop here)
3. Is it a question?    → Direct answer (stop here)
4. Does it touch UI?    → UI path
5. Does it touch DB?    → New task, HIGH risk flag
6. Feature / Bug / Refactor → New task, standard pipeline
```

---

## 3. Architecture — The Six Agents

Agents are defined in `.opencode/agents/`. Each is a markdown file with an explicit role, rules, input format, and output format. They are loaded via the `instructions` array in `opencode.json`.

---

### CTO — Chief Task Orchestrator

**File:** `.opencode/agents/cto.md`
**Mode:** `primary` (appears in agent selector, set as entry point)

The CTO is the only agent the user directly interacts with. It does not execute tasks. It decides what to do next and hands off to the right agent.

**Responsibilities:**
- Classify every session as "new task" or "resume" on first message
- Classify task type (feature, bug, question, review-only, refactor, migration)
- Route to the correct pipeline based on task type
- Enforce stage order — no skipping allowed
- Track current stage throughout the session
- Handle `/نوقف` and `/نكمل` commands
- Stop and wait for user approval when `risk_level = CRITICAL`
- Pass lean, scoped context between stages — not full file dumps

**Must NOT:**
- Write code
- Analyze tasks (that's Architect)
- Run tests (that's Test Engineer)
- Review diffs (that's Reviewer)
- Auto-resume a paused task without explicit `/نكمل`
- Skip any stage for speed or convenience

**Output at each decision point:**
```
CTO — [stage]
══════════════
Task   : [one line]
Stage  : [current → next]
Action : [what I'm doing now]
Risk   : [LOW | MEDIUM | HIGH | CRITICAL]
──────────────────────────────────────────
[Routing to: ARCHITECT / EXECUTOR / TEST ENGINEER / REVIEWER / QA]
```

---

### ARCHITECT

**File:** `.opencode/agents/architect.md`
**Mode:** `subagent` (not in selector — used internally by CTO)

Analyzes the task before any code is written. Produces a structured plan the Executor follows exactly.

**Responsibilities:**
- Detect ambiguity and ask blocking questions (only questions that change the implementation)
- Assess impact across all four layers: backend, database, dashboard, mobile
- Assess risk level accurately — does not downgrade risk to avoid friction
- Produce a step-by-step implementation plan with exact file names
- Define required tests explicitly (not "write some tests")
- Flag risk scenarios: race conditions, rollback needs, permission edges

**Must NOT:**
- Write or suggest code
- Skip the `required_tests` section
- Assume answers to blocking questions — must stop and ask
- Treat database changes as low-risk by default

**Output (all fields required):**
```
ARCHITECT ANALYSIS
==================
task_type:          [feature | bug | refactor | migration | question | security]
risk_level:         [LOW | MEDIUM | HIGH | CRITICAL]
problem_statement:  ...
blocking_questions: [list or "none — proceed"]
decisions_needed:   ...
impact_analysis:    backend / database / dashboard / mobile / shared
implementation_plan: [numbered steps with exact file paths]
required_tests:     unit / integration / e2e / regression
files_to_read_next: [minimum file list for Executor]
risk_flags:         ...
```

**CareKit sensitivity rules:**
- `bookings/`, `payments/`, `zatca/`, `auth/` → always HIGH or CRITICAL
- Schema change → always ask about rollback plan
- Recurring appointment logic → explicitly scope (this / following / all)
- Payment/ZATCA → CRITICAL, stop for owner approval before planning

---

### EXECUTOR

**File:** `.opencode/agents/executor.md`
**Mode:** `subagent`

Implements the Architect's approved plan. Changes are surgical — only what the plan describes.

**Responsibilities:**
- Read all files in `files_to_read_next` before touching anything
- Execute `implementation_plan` steps in order
- Verify each change matches existing file patterns
- Stop and report if the situation isn't covered by the plan — do not improvise
- Keep changes minimal and targeted

**Must NOT:**
- Redesign architecture
- Refactor code outside the plan scope
- Add utilities, abstractions, or features not requested
- Continue if an unplanned situation is encountered

**Code rules enforced:**
- TypeScript strict mode — no `any`, no unjustified type assertions
- 350-line max per file (500 for test files)
- No commented-out code, no `console.log`
- Backend: `class-validator` on all DTOs, `@ApiProperty` on all DTO properties
- Frontend pages: ≤120 lines
- Migrations: additive only — new columns need defaults or `nullable`

**Output:**
```
EXECUTOR DELIVERY
=================
steps_completed: [numbered list with file paths]
files_changed:   [path: what changed in one line]
edge_cases_noted: [things outside plan scope — do NOT fix them]
ready_for: TEST_ENGINEER
```

---

### TEST ENGINEER

**File:** `.opencode/agents/test-engineer.md`
**Mode:** `subagent`

Adds tests for every change. Tests are not optional and are not a separate task — they are part of the delivery.

**Responsibilities:**
- Write regression tests for every bug fix (reproduce the exact failure)
- Write behavior tests + edge cases for every new feature
- Write integration tests for booking logic changes
- Write both allowed AND denied test cases for auth/permission changes
- Run scoped tests and confirm they pass before handing off

**Must NOT:**
- Mock the database in integration tests — real Prisma test client only
- Skip the regression test on a bug fix
- Write tests that only assert a function was called (must assert behavior)

**Test priority order:**
1. Regression (bug scenario reproduction)
2. Happy path
3. Edge cases
4. Error/failure paths
5. Auth/permission boundaries

**Test locations:**
```
Backend unit:     backend/src/modules/<module>/tests/*.spec.ts
Backend unit alt: backend/test/unit/<module>/*.spec.ts
Backend E2E:      backend/test/e2e/<module>/<feature>.e2e-spec.ts
Dashboard unit:   dashboard/test/unit/**/*.spec.ts
Dashboard E2E:    dashboard/test/e2e/*.spec.ts (Playwright)
Mobile:           mobile/**/__tests__/*.spec.ts
```

**Output:**
```
TEST ENGINEER DELIVERY
======================
tests_written:   [file path: what scenario]
commands_run:    [command → PASS/FAIL]
coverage_delta:  [before/after]
gaps_noted:      [scenarios not covered — for future]
ready_for: REVIEWER
```

---

### REVIEWER

**File:** `.opencode/agents/reviewer.md`
**Mode:** `subagent`

Reviews the diff — not full files. Strict. Rejects weak work.

**Responsibilities:**
- Validate implementation matches the Architect's plan
- Detect logic errors and silent failures
- Flag TypeScript violations
- Check security — auth guards, input validation, no PII in logs
- Validate test quality — tests must assert behavior, not just presence

**Reviews on 5 dimensions:**
1. **Plan adherence** — does the diff match the plan exactly?
2. **Logic correctness** — does it solve the problem without new issues?
3. **TypeScript strictness** — no `any`, explicit return types
4. **Security** — guards present, inputs validated, no leaks
5. **Test quality** — required tests present and actually testing behavior

**Scoring:**
| Score | Decision |
|-------|----------|
| 9–10 | PASS |
| 7–8 | PASS (minor issues logged as tech debt) |
| 5–6 | PASS + tech debt note |
| ≤ 4 | FAIL → back to Executor |

**CareKit auto-FAIL triggers:**
- Missing regression test on a bug fix
- `any` in payment, booking, or auth code
- Endpoint without `JwtAuthGuard`
- Booking status updated without activity-log entry
- Migration file modified (not new, not additive)

**Must NOT:**
- Write or modify code
- Review full files — diff only

---

### QA VALIDATOR

**File:** `.opencode/agents/qa-validator.md`
**Mode:** `subagent`

The last gate before delivery. Simulates production risk from the perspective of a live clinic.

**Responsibilities:**
- Assess appointment workflow risk (double-booking, slot integrity, no-show logic)
- Assess regression risk across shared code paths
- Assess data integrity (partial failures, migration safety, race conditions)
- Assess production stability (zero-downtime safety, BullMQ compatibility)
- Assess payment and regulatory risk (Moyasar idempotency, ZATCA duplicates)

**Must NOT:**
- Re-review code quality (Reviewer already did this)
- Auto-retry on failure — QA failure goes back to Architect, not Executor

**Scoring:**
| Score | Decision |
|-------|----------|
| 8–10 | QA PASS |
| 6–7 | QA PASS + monitoring notes |
| ≤ 5 | QA FAIL → back to Architect |

**CareKit auto-FAIL triggers:**
- Change that could double-book a slot
- Migration without rollback plan on large tables
- BullMQ job change without backward compatibility check
- Payment flow change without idempotency verification
- API contract break without version bump

---

## 4. Workflow — Step by Step

### Standard flow (feature or bug)

```
User input
    │
    ▼
CTO — classify session (new vs /نكمل)
    │
    ▼
CTO — classify task type
    │
    ▼
[1] analyze-task pipeline
    └── Architect produces plan + required tests
    └── Decision gate:
        ├── Blocking questions? → PAUSE, user answers, then continue
        └── risk = CRITICAL? → PAUSE, wait for explicit approval
    │
    ▼
[2] implement-plan pipeline
    └── Executor reads only files in plan's file list
    └── Implements plan steps in order
    └── tsc + lint validation (auto)
    │
    ▼
[3] write-tests pipeline
    └── Test Engineer writes regression/behavior/edge-case tests
    └── Runs scoped tests (--testPathPattern)
    └── Coverage gate checked (non-blocking, warns if below threshold)
    │
    ▼
[4] review-diff pipeline
    └── Reviewer checks git diff on 5 dimensions
    └── Score ≥ 7 → PASS
    └── Score ≤ 4 → FAIL → back to Executor (max 1 retry)
    └── 2 failures → escalate to user
    │
    ▼
[5] qa-check pipeline
    └── QA Validator checks production risk
    └── Score ≥ 6 → QA PASS
    └── Score ≤ 5 → QA FAIL → back to Architect (not Executor)
    │           └── No automatic retry — user must decide
    ▼
[6] memory-write pipeline
    └── Classify learnings: decision / domain rule / bug lesson / test lesson / API contract
    └── Append to correct section in opencode.md
    └── Clear active-work session state
    │
    ▼
Ready to commit
```

### Loop logic

| Failure point | Goes back to | Max retries |
|---------------|-------------|-------------|
| tsc/lint after implement | Executor | 1 |
| Tests failing | Test Engineer | 2 |
| Reviewer FAIL | Executor | 1 (then escalate to user) |
| QA FAIL | Architect | 0 (user must decide) |

**Why QA failure goes to Architect, not Executor:**
If QA detects a production risk (e.g., possible double-booking), the implementation plan itself was flawed. The Executor followed the plan correctly — the plan needs to be rethought.

**Why Reviewer failure goes to Executor, not Architect:**
If the Reviewer finds a missing test or a TypeScript violation, the plan was correct but execution was incomplete. The Executor fixes it.

### Short-circuit routes

Tasks don't always need the full pipeline:

| Task type | Route |
|-----------|-------|
| Feature / Bug / Refactor | Full pipeline (1→2→3→4→5→6) |
| Question / Explanation | CTO answers directly |
| Review only | Pipeline 4 only |
| Tests only | Pipeline 3 only |
| Schema/migration | Full pipeline with HIGH risk enforced at step 1 |

---

## 5. Session Model

### The core rule

There are exactly two session types. Nothing else.

---

### Type A — New Session (default)

Any input that is NOT the exact string `/نكمل` is treated as a completely new task.

- CTO does NOT load `current-task.json`
- CTO does NOT check for paused work
- CTO does NOT infer "this seems like a continuation"
- Workflow starts from scratch

This applies even if you have a paused task saved. Opening 10 sessions without typing `/نكمل` means 10 independent new tasks.

---

### Type B — Resume Session

Triggered ONLY when the user's first message is exactly `/نكمل`.

- CTO reads `.opencode/context/current-task.json`
- Follows the `/نكمل` command behavior
- Resumes from `current_stage`

No other phrase or context triggers resume. If you describe the same task again without typing `/نكمل`, it's a new task.

---

### Pause — /نوقف

Can be used at any point during a session.

- CTO writes current state to `current-task.json`
- Marks status as `"paused"`
- Stops working — no continuation

---

### Decision table

| First message | Behavior |
|---------------|----------|
| "اصلح bug في الحجز" | New task |
| "راجع هذا الكود" | New task |
| "what does X do?" | New task, answered directly |
| `/نوقف` | Saves state, stops |
| `/نكمل` | Reads state, resumes paused task |
| `/نكمل` when no paused task | Says so clearly, stops |
| `/نكمل` when task is done | Says task is done, stops |

---

## 6. Commands

### /نوقف — Pause

**File:** `.opencode/commands/نوقف.md`

#### When to use
- Before closing a session mid-task
- When you need to stop and continue later
- When something came up and you need to pause the work

#### What it does
1. Reads the current session state
2. Writes `.opencode/context/current-task.json` with structured fields
3. Sets `status: "paused"`
4. Prints a brief confirmation
5. Stops — no continuation, no analysis, no new code

#### What it does NOT do
- Continue working after saving
- Re-analyze the task
- Auto-resume in the next session

#### Output after /نوقف
```
⏸ Task paused.

Stage saved: [current_stage]
Progress: [progress]

Resume with /نكمل in any future session.
```

---

### /نكمل — Resume

**File:** `.opencode/commands/نكمل.md`

#### When to use
- At the start of a new session when you want to continue paused work

#### What it does
1. Reads `.opencode/context/current-task.json`
2. Checks `status` field
3. If `"paused"` → shows summary and asks for confirmation
4. User confirms → resumes from `current_stage`
5. Loads `decisions`, `files`, `tests_added`, `next_steps`, `blockers` as context
6. After QA pass + memory write → marks task as `"done"`

#### Decision tree on /نكمل
```
status = "none" or file missing
  → "لا يوجد مهمة موقوفة للاستئناف"
  → Stop

status = "done"
  → "المهمة مكتملة بالفعل"
  → Stop

status = "paused"
  → Show summary
  → Ask for confirmation
  → Resume from current_stage
```

#### What it does NOT do
- Start a new task
- Analyze a new problem
- Write code for anything other than the saved task
- Proceed past non-empty `blockers` without surfacing them to the user

#### What it is NOT
- A generic workflow starter
- Auto-triggered at session start
- Triggered by describing the task again

---

## 7. Task State File

**Location:** `.opencode/context/current-task.json`

### What this file is — and what it is NOT

**This file is a pause snapshot. Nothing more.**

It is written exactly once: when the user types `/نوقف`. It is read exactly once: when the user types `/نكمل` in a new session.

It does **not** track the active state of a running session. While a task is in progress, CTO tracks stage and progress internally within the session context — the file is not updated, not polled, and not referenced until `/نوقف` is called.

```
During session:   CTO tracks stage internally (in-context only)
                  current-task.json is NOT touched

/نوقف called:     CTO snapshots current state → writes file → stops
                  status = "paused"

New session:      file sits untouched unless /نكمل is typed
/نكمل typed:      file is read → task resumes from saved stage

QA + memory done: status updated to "done"
                  file remains but is not reusable until overwritten
```

This design is intentional. The file is not a live database — it is a handoff note left for the next session.

### Structure

```json
{
  "task": "",
  "status": "none",
  "current_stage": "",
  "progress": "",
  "decisions": [],
  "files": [],
  "tests_added": [],
  "next_steps": [],
  "blockers": []
}
```

### Field reference

| Field | Type | Populated by | Purpose |
|-------|------|-------------|---------|
| `task` | string | /نوقف | One sentence — what the task is |
| `status` | `"none"` \| `"paused"` \| `"done"` | system | Lifecycle gate — only `"paused"` triggers resume |
| `current_stage` | `"analyze"` \| `"implement"` \| `"test"` \| `"review"` \| `"qa"` \| `"completed"` | /نوقف | Stage to resume from |
| `progress` | string | /نوقف | One sentence — what is done, not what was attempted |
| `decisions` | string[] | /نوقف | Choices made this session that affect implementation |
| `files` | string[] | /نوقف | All files touched (relative paths from repo root) |
| `tests_added` | string[] | /نوقف | Test files written so far (empty if none yet) |
| `next_steps` | string[] | /نوقف | Specific next action — not vague. First item is what /نكمل surfaces to user |
| `blockers` | string[] | /نوقف | Unresolved questions — surfaced before execution on resume |

### State lifecycle

```
Initial / empty:  status = "none"     → /نكمل says "no paused task"
After /نوقف:      status = "paused"   → /نكمل can resume
After completion: status = "done"     → /نكمل says "already done"
Overwritten:      new /نوقف call replaces the file entirely
```

### Rules
- One task at a time — a new `/نوقف` overwrites any previous paused task
- `next_steps[0]` is the first thing shown to user on resume — make it specific and actionable
- `blockers` must be surfaced before executing on resume — CTO will not proceed past them silently
- `decisions` only includes choices that would change the implementation if made differently
- `files` uses paths relative to repo root, not absolute paths

---

## 8. Pipelines

Pipelines are YAML files in `.opencode/pipelines/`. They define multi-step workflows with dependencies, gates, and retry logic.

---

### analyze-task

**File:** `.opencode/pipelines/analyze-task.yaml`
**Trigger:** Manual (called by CTO for features, bugs, refactors, migrations)

**Purpose:** Run the Architect agent and produce a structured plan before any code is written.

**Steps:**
1. Load `opencode.md` and `AGENTS.md` — sections only, not full files
2. Run Architect agent — produces structured analysis with all required fields
3. Decision gate:
   - If `blocking_questions` is not empty → PAUSE, surface to user
   - If `risk_level = CRITICAL` → PAUSE, wait for explicit approval
4. Save analysis to session memory under `active_work.current_task_analysis`

**Expects:** Task description + optional file paths or error context  
**Produces:** Full Architect analysis saved to memory

---

### implement-plan

**File:** `.opencode/pipelines/implement-plan.yaml`
**Trigger:** Manual (after analyze-task completes and decision gate clears)

**Purpose:** Implement the Architect's plan using the Executor agent.

**Preconditions:** Architect analysis must exist. Blocking questions must be resolved.

**Steps:**
1. Load only `implementation_plan + files_to_read_next + required_tests` from memory — not the full analysis
2. Read only the files listed in `files_to_read_next` — no extra reads
3. Run Executor agent — implements plan steps in order, reports edge cases
4. Auto-run `tsc --noEmit` — retry once on fail
5. Auto-run lint — retry once on fail
6. Save executor delivery to memory under `active_work.implementation_complete`

**Expects:** Approved Architect analysis in memory  
**Produces:** Changed files, tsc/lint passing, executor delivery in memory

---

### write-tests

**File:** `.opencode/pipelines/write-tests.yaml`
**Trigger:** Manual (after implement-plan completes)

**Purpose:** Write tests for every change. No exceptions.

**Preconditions:** Implementation must be complete.

**Enforced rules:**
- Bug fix → regression test required
- Feature → behavior tests + edge cases required
- Auth change → allowed + denied test cases required
- Booking logic change → integration test required

**Steps:**
1. Load `required_tests` from Architect analysis + `files_changed` from Executor — diff only, not full files
2. Run Test Engineer agent — writes tests against the diff
3. Run scoped tests: `npm run test -- --testPathPattern="<affected-module>"`
4. Retry up to 2 times if tests fail, then escalate to user
5. Run coverage check (non-blocking — warns if branch < 40%, function/line < 50%)
6. Save test delivery to memory under `active_work.tests_complete`

**Expects:** Executor delivery in memory, changed files on disk  
**Produces:** Tests written and passing, coverage reported

---

### review-diff

**File:** `.opencode/pipelines/review-diff.yaml`
**Trigger:** Manual (after write-tests completes)

**Purpose:** Strict review of the git diff on 5 dimensions.

**Preconditions:** Tests must be complete.

**Steps:**
1. Load structured summaries from memory — not full files
2. Get git diff (`git diff HEAD~1..HEAD`)
3. Run Reviewer agent on the diff
4. Review gate: score ≥ 7 passes; ≤ 4 fails
5. On fail: return to Executor, max 1 retry, then escalate to user
6. Save review report to memory under `active_work.review_complete`

**Expects:** Completed tests, git diff available  
**Produces:** Review report with score and decision

---

### qa-check

**File:** `.opencode/pipelines/qa-check.yaml`
**Trigger:** Manual (after review-diff passes)

**Purpose:** Production risk simulation. The last gate before delivery.

**Preconditions:** Review must have passed.

**Steps:**
1. Load `risk_level + risk_flags` from Architect analysis + reviewer decision from memory
2. Run QA Validator agent
3. QA gate: score ≥ 6 passes; ≤ 5 fails
4. On fail: return to Architect — no automatic retry, user must decide
5. Save QA report to memory under `active_work.qa_complete`

**Expects:** Review report in memory  
**Produces:** QA report with production risk assessment and monitoring notes

---

### memory-write

**File:** `.opencode/pipelines/memory-write.yaml`
**Trigger:** Manual (after qa-check passes)

**Purpose:** Persist what was learned to `opencode.md` for future sessions.

**Preconditions:** QA must have passed.

**Steps:**
1. Load full session summary from all memory keys
2. Classify learnings into categories:
   - `decision` → new architectural choice
   - `domain_rule` → new business rule discovered
   - `bug_lesson` → bug fixed with root cause and regression test
   - `test_lesson` → testing pattern that worked or failed
   - `api_contract` → API shape defined or changed
3. Append to correct section in `opencode.md` — does not overwrite
4. Clear active-work session state from memory
5. Confirm memory was written

**Expects:** All stage results in memory  
**Produces:** `opencode.md` updated, session state cleared

---

### tokenscope

**File:** `.opencode/pipelines/tokenscope.yaml`
**Trigger:** Manual (optional, recommended before L or XL tasks)

**Purpose:** Audit context size and trim before an expensive operation.

**Checks:**
- Files in context: warn at 7, stop at 10
- Context window usage: warn at 60%, stop at 80%
- Full files when diff would suffice → trim to diff
- Same file sent to multiple agents → deduplicate

**Produces:** Trim recommendations + estimated token savings

---

### feature-workflow

**File:** `.opencode/pipelines/feature-workflow.yaml`
**Trigger:** Manual

**Purpose:** Run all stages in sequence with correct gate routing. Use this for any feature or bug fix.

**Sequence:**
```
tokenscope (optional) → analyze-task → implement-plan → write-tests → review-diff → qa-check → memory-write
```

Each stage has its own gate. Failures route to the correct previous stage as described in the workflow section above.

---

## 9. Token Optimization

### The problem

Long AI sessions are expensive and degrade in quality. When too much context is loaded, the model:
- Spends tokens on irrelevant information
- Produces lower-quality outputs
- Becomes expensive unnecessarily

CareKit has 30+ backend modules, 25+ dashboard routes, multiple schema files. Loading everything for every task would be wasteful and counterproductive.

### How this system controls token usage

**Stage isolation.** Each stage gets only the context it needs. The Executor doesn't get the full Architect output — it gets only `implementation_plan + files_to_read_next`. The Reviewer doesn't get full files — it gets the git diff.

**Scoped file reads.** The Executor reads only files in `files_to_read_next`. Not the whole module. Not the whole backend. Only the specific files the plan identified.

**Diff over files.** Between the Test Engineer and Reviewer stages, only the diff is passed — not the full contents of changed files.

**Scoped test runs.** Tests are run with `--testPathPattern="<module>"` — not the full test suite. A booking bug runs booking tests, not all 30 modules.

**Section loading.** `opencode.md` is a large project memory file. Agents load only the sections relevant to their stage — not the entire file.

**The /نوقف + /نكمل pattern.** Long tasks across multiple days accumulate session history. By saving state to `current-task.json` and resuming with a fresh session, the context window starts clean. The resume loads only the structured JSON — not a replay of the entire previous session.

**CTO routing.** Without CTO, every request would load all agent prompts, all pipelines, all context. CTO loads only what the current stage needs. Sub-agents are loaded per stage, not all at once.

### Rules enforced

Always:
- Pass diff between stages, not full files
- Use `--testPathPattern` not full suite
- Load only files in `files_to_read_next`
- Load opencode.md sections, not the full file
- Pass `implementation_plan` steps, not the full Architect output

Never:
- Send full `AGENTS.md` to every step
- Run full test suite when 1 module changed
- Load all 30 backend modules for a single-file change
- Pass full `opencode.json` to any agent
- Scan the entire codebase without a specific need

---

## 10. Daily Usage Guide

### Starting a new task

Just type what you need. CTO handles routing.

```
اصلح مشكلة الحجز في walk-in
```

CTO classifies this as a bug, routes to `analyze-task` pipeline. The Architect will analyze the problem and ask blocking questions if any exist. You answer. Implementation proceeds.

---

### When Architect asks a blocking question

The pipeline pauses at the decision gate. Answer the question directly. CTO resumes routing after you respond.

Example:
```
Architect: Q1: Should walk-in bookings be exempt from no-show blocks, or subject to the same rule as regular bookings?
You: Same rule — walk-ins are not exempt
CTO: Proceeding to implement...
```

---

### When risk is CRITICAL

The pipeline stops and shows you the Architect's analysis. You must explicitly approve before implementation starts.

```
You: Approve — proceed with plan
CTO: Routing to Executor...
```

---

### If Reviewer fails

The pipeline returns to the Executor with specific failure reasons. You don't need to do anything — the Executor fixes the issues and the Reviewer runs again. If it fails a second time, you're asked to make a decision.

---

### If QA fails

This means the plan had a production risk issue. CTO returns to Architect. The Architect re-analyzes with the QA failure as additional context. You may need to answer new questions.

---

### Pausing mid-task

Type `/نوقف` at any point. CTO saves state to `current-task.json` and stops.

```
/نوقف
```

Output:
```
⏸ Task paused.

Stage saved: implement
Progress: Architect analysis complete. Executor has modified BookingsService.create().

Resume with /نكمل in any future session.
```

---

### Resuming a paused task

Open a new session. Type `/نكمل` as your first message.

```
/نكمل
```

System shows:
```
⏩ استئناف المهمة:

المهمة   : Fix no-show block not enforced on walk-in bookings
المرحلة  : implement
التقدم   : Executor has modified BookingsService.create()
الخطوة التالية: Write regression test in bookings.service.spec.ts

هل تريد المتابعة؟ (نعم / لا)
```

Confirm → resumes from where you stopped.

---

### After workflow completes

When QA passes and memory is written, CTO confirms the workflow is done and shows commit instructions:

```
✅ Workflow complete. Ready to commit.

Commit format:
  feat(module): description
  fix(module): description

Rules:
  - One system per commit
  - Max 10 files or 500 lines per commit
  - Use: git add -p (selective staging)
```

---

### Running individual pipelines

If you only need one stage:

```
/pipeline analyze-task        # Analyze without implementing
/pipeline review-diff         # Review current diff
/pipeline write-tests         # Write tests for current changes
/pipeline tokenscope          # Audit context before a large task
```

---

## 11. Full Example — Bug Fix Scenario

**Task:** Patients with an unresolved no-show can still book walk-in appointments.

---

### Session 1 — Start and work through implement stage

**User:** اصلح مشكلة: المريض عنده no-show مفتوح وعارف يحجز walk-in

**CTO:** New session detected. Classifying as bug. Routing to analyze-task pipeline.

---

**Architect output:**
```
task_type: bug
risk_level: HIGH

problem_statement:
  Walk-in booking flow does not check the no-show block that applies to regular bookings.
  The isNoShow flag on Booking is checked in create() but the walk-in bypass path skips it.

blocking_questions:
  Q1: Should walk-in bookings be exempt from no-show blocks, or subject to the same rule?

decisions_needed:
  D1: Which walk-in bypass conditions should remain — only time-slot bypass, or also no-show bypass?

impact_analysis:
  backend:  bookings.service.ts — create() method, walk-in branch
  database: no schema change needed
  dashboard: no change
  mobile: no change
  shared: no change

implementation_plan:
  1. In bookings.service.ts → remove the early-return in the walk-in bypass that skips no-show check
  2. Ensure no-show check runs before walk-in path returns

required_tests:
  regression: Walk-in booking blocked when patient has unresolved no-show
  unit: BookingsService.create() — walk-in with no-show → throws ConflictException
  unit: BookingsService.create() — walk-in without no-show → succeeds

files_to_read_next:
  - backend/src/modules/bookings/bookings.service.ts

risk_flags:
  - Ensure the walk-in time-slot bypass is preserved — only the no-show check should be added back
```

**User:** Q1: Same rule — walk-ins are not exempt

**CTO:** Blocking question resolved. Decision gate clears. Routing to implement-plan.

---

**Executor delivery:**
```
EXECUTOR DELIVERY
=================
steps_completed:
  1. ✅ Removed early-return from walk-in path before no-show check
     → backend/src/modules/bookings/bookings.service.ts

files_changed:
  - backend/src/modules/bookings/bookings.service.ts: removed early return at line 47

edge_cases_noted:
  Walk-in path still bypasses time-slot check — as intended per plan

ready_for: TEST_ENGINEER
```

---

**User:** `/نوقف` (needs to leave)

**Current-task.json written:**
```json
{
  "task": "Fix no-show block not enforced on walk-in bookings",
  "status": "paused",
  "current_stage": "implement",
  "progress": "Executor has removed early-return in walk-in path. tsc and lint pass.",
  "decisions": [
    "Walk-in bookings are not exempt from no-show blocks"
  ],
  "files": [
    "backend/src/modules/bookings/bookings.service.ts"
  ],
  "tests_added": [],
  "next_steps": [
    "Run write-tests pipeline — write regression test for walk-in + no-show scenario in backend/src/modules/bookings/tests/bookings.service.spec.ts"
  ],
  "blockers": []
}
```

**Output:**
```
⏸ Task paused.
Stage saved: implement
Progress: Executor has removed early-return in walk-in path. tsc and lint pass.
Resume with /نكمل in any future session.
```

---

### Session 2 — Resume and finish

**User:** `/نكمل`

**System reads current-task.json:**
```
⏩ استئناف المهمة:
المهمة   : Fix no-show block not enforced on walk-in bookings
المرحلة  : implement
التقدم   : Executor has removed early-return. tsc and lint pass.
الخطوة التالية: Run write-tests pipeline

هل تريد المتابعة؟ (نعم / لا)
```

**User:** نعم

**CTO:** Resuming at implement stage. Routing to write-tests pipeline.

---

**Test Engineer delivery:**
```
TEST ENGINEER DELIVERY
======================
tests_written:
  - backend/src/modules/bookings/tests/bookings.service.spec.ts:
      regression — walk-in booking blocked when patient has unresolved no-show
  - backend/src/modules/bookings/tests/bookings.service.spec.ts:
      unit — walk-in without no-show succeeds

commands_run:
  - cd backend && npm run test -- --testPathPattern="bookings" → PASS (3 new tests)

coverage_delta: branch 42% → 45%

ready_for: REVIEWER
```

---

**Reviewer report:**
```
plan_adherence: MATCH
logic_review: clean
typescript_review: clean
security_review: clean
test_review: required_tests_covered: YES — regression test reproduces exact failure

score: 9/10
decision: PASS
ready_for: QA_VALIDATOR
```

---

**QA Validation:**
```
appointment_workflow_risk: SAFE — no-show check now covers walk-in path
regression_risk: LOW — change is isolated to walk-in branch
data_integrity: SAFE — no schema changes, no partial failure risk
production_stability: SAFE — safe to deploy

score: 9/10
decision: QA_PASS
monitoring_notes: Monitor walk-in booking error rate for 24h post-deploy
ready_for: MEMORY_WRITE
```

---

**Memory written to opencode.md Section 12.3:**
```
[2026-04-09] BUG: Walk-in path skipped no-show block
ROOT_CAUSE: Early-return at line 47 in BookingsService.create() bypassed the check
FIX: Removed early-return — no-show check now runs before walk-in bypass
REGRESSION_TEST: backend/src/modules/bookings/tests/bookings.service.spec.ts
```

**CTO:** Workflow complete. Ready to commit.

---

## 12. Key Design Decisions

### Why CTO is used as the entry point

Without a routing layer, every request would need to load all agent prompts, all project context, and all pipeline definitions. This is wasteful and produces lower quality — the model doesn't know which role it's in.

CTO acts as a thin router. It knows the roles, knows the stages, and loads only what the current stage needs. It also enforces that no stage is skipped and that failures route to the correct previous stage.

### Why agents are separated into 6 roles

Each agent has a different mandate, different inputs, and different failure modes. If one agent does everything, the model confuses its own roles:

- The Architect might start writing code if it also has Executor instructions
- The Reviewer might be lenient if it also has responsibility for delivery
- The QA Validator might miss production risks if it's also checking TypeScript

Separation enforces a clean separation of concerns. Each agent reads only what's relevant to its role.

### Why resume is manual (/نكمل) and not automatic

Auto-loading paused work at session start would make every new conversation a potential continuation. You open a session to ask a quick question, and the system tries to resume a week-old bug fix. This is disruptive.

Manual resume via `/نكمل` means the decision to resume is explicit. You know what you're doing. The system confirms the task before proceeding.

### Why the build agent is the OpenCode entry point

OpenCode's agent selector shows agents with `mode: "primary"`. The CTO agent is configured with `mode: "primary"` and a description that says "Start here". The other 5 agents are `mode: "subagent"` — they stay out of the selector and are invoked internally.

This means the user selects CTO once and it becomes the interface layer. All routing happens inside the session, not through the UI.

### Why QA failure goes to Architect (not Executor)

If the QA Validator finds that a change could double-book an appointment, the problem is not that the Executor wrote bad code. The problem is that the plan didn't account for the double-booking scenario. The Executor correctly implemented the plan. The plan was wrong. The Architect needs to rethink.

---

## 13. Design System Governance

CareKit uses a proprietary design system called **carekit-ds** (Frosted Glass Design System). Any UI agent — including `ui-ux-pro-max` — must operate within its constraints. carekit-ds always wins. `ui-ux-pro-max` is supplemental.

---

### Source of Truth

**Single file: `dashboard/app/globals.css`**

All design tokens are CSS custom properties defined in this file. No token, color, or spacing value exists anywhere else in a canonical form. If it is not in `globals.css`, it is not part of the design system.

---

### Token Reference

| Token | Purpose | Notes |
|-------|---------|-------|
| `--primary` | Brand primary color | Royal Blue `#354FD8` by default — overridden per client |
| `--accent` | Secondary brand color | Lime Green `#82CC17` by default — overridden per client |
| `--surface` | Glass surface background | Semi-transparent white |
| `--border` | Border and separator color | Subtler than default shadcn border |
| `--success` | Positive state (active, confirmed) | Green tone |
| `--warning` | Caution state (pending, draft) | Amber tone |
| `--error` | Error state (failed, rejected) | Red tone |
| `--destructive` | Destructive actions (delete) | Distinct from error — action-specific |
| `--muted` | Subdued text, secondary labels | Never use `text-gray-*` classes |
| `--muted-foreground` | Muted text foreground | Never use `text-gray-*` classes |

**White-label rule**: Never hardcode `#354FD8`, `#82CC17`, or any hex value that represents the default CareKit brand. Every color must reference a token. Each client deployment overrides the tokens — not the components.

---

### Typography

| Rule | Value |
|------|-------|
| Font family | IBM Plex Sans Arabic — no other font |
| Minimum body text (mobile) | 16px |
| Heading scale | Use Tailwind `text-*` with token-mapped colors |
| Arabic numerals | Use Arabic-Indic (`٠١٢٣`) in Arabic locale, Western in English locale |
| Line height | Generous — Arabic script needs more vertical breathing room than Latin |

---

### Spacing and Direction

CareKit is **RTL-first**. Arabic is the default layout direction; LTR is an override.

| Rule | Correct | Wrong |
|------|---------|-------|
| Horizontal padding | `ps-4 pe-4` | `pl-4 pr-4` |
| Horizontal margin | `ms-2 me-2` | `ml-2 mr-2` |
| Flex direction | `flex-row` (RTL reverses it automatically) | Manually flipping with JS |
| Text alignment | `text-start` / `text-end` | `text-left` / `text-right` |
| Absolute positioning | `start-0` / `end-0` | `left-0` / `right-0` |

**Never use physical directional classes** (`left`, `right`, `pl-`, `pr-`, `ml-`, `mr-`). RTL layouts break silently with physical classes.

---

### Glass Classes

| Class | Surface type | Usage |
|-------|-------------|-------|
| `.glass` | Standard glass | Filter bars, cards, modals |
| `.glass-solid` | Opaque glass | Sidebars, navigation |
| `.glass-strong` | Heavy glass | Overlays, drawers |

These classes are defined in `globals.css` and must not be recreated inline. Do not use `backdrop-blur` ad-hoc without using a glass class.

---

### Icon Library

**Exclusively `@hugeicons/react`**. No other icon library.

```tsx
// Correct
import { UserIcon } from "@hugeicons/react";

// Wrong — do not use
import { User } from "lucide-react";
import UserIcon from "@mui/icons-material/User";
```

If a required icon does not exist in `@hugeicons/react`, use the closest semantic match from the same library. Do not introduce a second icon library.

---

### i18n Rules

Every user-visible string must have both Arabic and English entries.

| Location | File pattern |
|----------|-------------|
| Dashboard translations | `dashboard/lib/translations/*.ts` |
| Shared token keys | `shared/i18n/` |

Rules:
- **Arabic is always the primary string** — write the AR string first, EN second
- All date display: `toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" })`
- Never hardcode Arabic or English strings in components — always use translation keys
- RTL direction is set at the HTML `dir` attribute level — never toggle it in individual components

---

### Page Anatomy Law

Every dashboard list page must follow this exact structure. This is not a recommendation — it is enforced by the Reviewer:

```
Breadcrumbs
PageHeader: Title + Description | [Export outline] [+ Add primary]
ErrorBanner (only if error)
StatsGrid: 4× StatCard (Total · Active · Inactive · New)
FilterBar (glass): [Search] [Status ▼] [Other filters ▼] [Reset]
DataTable (no Card wrapper, no background)
Pagination (only if meta.totalPages > 1)
Dialogs / Sheets (at bottom, form pages only)
```

Key enforcement points:
- Search is in **FilterBar** — not PageHeader
- Export button is `variant="outline"` — left of Add button
- DataTable has **no Card wrapper** — it sits bare in page flow
- Table actions are **icon-only** (size-9, rounded-sm) with Tooltip — no text labels
- Skeletons: 4× `h-[100px]` for StatsGrid, 5× `h-12` for rows
- Status badges: `bg-success/10 text-success border-success/30` (active) / `bg-muted text-muted-foreground` (inactive)

**Add/Edit forms are always separate pages** — never dialogs, never popups, never drawers. This is non-negotiable.

---

### What UI Agents Must Never Violate

The following are hard constraints. Any diff that contains these patterns will be auto-failed by the Reviewer:

| Violation | Why |
|-----------|-----|
| Hardcoded hex color (`#354FD8`, `#82CC17`, or any hex) | Breaks white-label system |
| `text-gray-*`, `bg-gray-*` Tailwind classes | Use `text-muted`, `text-muted-foreground`, or tokens |
| `import { * } from "lucide-react"` | Only `@hugeicons/react` is allowed |
| `pl-`, `pr-`, `ml-`, `mr-`, `left-`, `right-` directional classes | RTL-unsafe — use logical properties |
| Add/Edit form inside a Dialog or Sheet | Forms are pages, not popups |
| `backdrop-blur` without a `.glass` class | Use defined glass classes only |
| Hardcoded Arabic or English strings in JSX | All strings must use translation keys |
| `dir="rtl"` toggled in a component | Direction is set at HTML root level only |
| Custom color not derived from a CSS token | Every color must reference a token from `globals.css` |
| Page layout deviating from the Page Anatomy Law | Structure is enforced — no custom layouts |

---

### carekit-ds vs ui-ux-pro-max

`ui-ux-pro-max` is a design intelligence skill that provides guidance on typography, color palettes, UX patterns, accessibility, and motion. It is a source of inspiration and principle — not authority.

**Precedence rule:**

```
carekit-ds (globals.css + Page Anatomy + Token system)
    ↑ always wins
ui-ux-pro-max (UX principles, accessibility checklist, pattern guidance)
    ↑ supplemental — accepted only when not conflicting with carekit-ds
```

When `ui-ux-pro-max` makes a suggestion that conflicts with a carekit-ds rule (e.g., suggests a different icon library, recommends inline colors, or proposes a different page structure), the carekit-ds rule wins without exception.

`ui-ux-pro-max` is always run with `--stack shadcn` for CareKit dashboard work.

---

## 14. Limitations and Notes

### CTO visibility in UI

OpenCode's agent selector shows agents based on their `mode` setting. CTO is set to `mode: "primary"`. OpenCode does not currently support a "default" agent that is pre-selected without user interaction. You need to select CTO once per session from the selector. After that, the workflow is automatic.

### Pipeline YAML is declarative, not executable

The pipeline YAML files (`.opencode/pipelines/*.yaml`) define the intended workflow. They are loaded as instructions by OpenCode, not executed as code. The AI model reads them and follows their logic. This means:
- They are enforced through the model's behavior, not through a pipeline engine
- Retries and routing logic depend on the model following the instructions correctly
- For true programmatic enforcement, a custom plugin or MCP tool would be needed

### One paused task at a time

The `current-task.json` file holds only one task. If you pause a task and start a new task in a different session, the new task's `/نوقف` will overwrite the previous paused state. There is no task history or stack — only the latest paused task.

### Memory is append-only

The `memory-write` pipeline appends to `opencode.md`. Over time, the Memory Categories section will grow. There is no automatic pruning or summarization. Periodically review and clean up stale entries manually.

### The opencode-openmemory plugin

This plugin was requested but does not exist as an npm package under that name. The memory system is implemented using `opencode.md` as a structured file instead. If a compatible memory plugin becomes available, it could replace the file-based approach.

---

## 15. File Map

```
carekit/
├── opencode.json                          # Main OpenCode config — plugins, instructions, agent config, MCP
├── opencode.md                            # Project memory — domains, rules, decisions, lessons
├── AGENTS.md                              # Maestro skill dispatch + session routing rules
│
└── .opencode/
    ├── package.json                       # Plugin dependencies (@openspoon/subtask2)
    │
    ├── agents/
    │   ├── cto.md                         # Master orchestrator — entry point, routing, session classification
    │   ├── architect.md                   # Analyzes tasks, produces plans, detects risk
    │   ├── executor.md                    # Implements plans with minimal scope
    │   ├── test-engineer.md               # Writes tests for every change
    │   ├── reviewer.md                    # Reviews diff on 5 dimensions
    │   └── qa-validator.md               # Production risk simulation
    │
    ├── commands/
    │   ├── نوقف.md                        # /نوقف — pause and save state
    │   └── نكمل.md                        # /نكمل — resume paused task
    │
    ├── context/
    │   └── current-task.json             # Task state — single paused/active task
    │
    ├── pipelines/
    │   ├── feature-workflow.yaml          # Full pipeline orchestrator (all stages)
    │   ├── analyze-task.yaml             # Stage 1 — Architect analysis
    │   ├── implement-plan.yaml           # Stage 2 — Executor implementation
    │   ├── write-tests.yaml             # Stage 3 — Test Engineer
    │   ├── review-diff.yaml             # Stage 4 — Reviewer
    │   ├── qa-check.yaml               # Stage 5 — QA Validator
    │   ├── memory-write.yaml            # Stage 6 — Persist lessons
    │   ├── tokenscope.yaml              # Token audit (optional, pre-task)
    │   └── release.yaml                 # Release validation pipeline (pre-existing)
    │
    └── WORKFLOW.md                        # Quick reference for daily use
```
