# CareKit OpenCode Workflow — Quick Reference

## The Pipeline

```
Task → analyze-task → [Decision Gate] → implement-plan → write-tests → review-diff → qa-check → memory-write → Commit
                            ↑                  ↑                              ↓            ↓
                     Blocking questions    Reviewer FAIL              QA FAIL goes    Memory updates
                     pause for answer      returns here              back to Architect   opencode.md
```

## How to Run (Day-to-Day Usage)

### Option A — Full workflow (recommended for features and bugs)
```
/pipeline feature-workflow
```
The pipeline handles all stages. It will pause at blocking questions and CRITICAL risk.

### Option B — Stage by stage (recommended when you want control)
```
/pipeline analyze-task       # Step 1: Architect analyzes — always run this first
# → Review output, answer blocking questions if any
/pipeline implement-plan     # Step 2: Executor implements approved plan
/pipeline write-tests        # Step 3: Test Engineer adds coverage
/pipeline review-diff        # Step 4: Reviewer checks diff quality
/pipeline qa-check           # Step 5: QA validates production risk
/pipeline memory-write       # Step 6: Write decisions/lessons to opencode.md
```

### Option C — Token audit before large tasks
```
/pipeline tokenscope         # Audit and trim context before an L or XL task
```

---

## When to Use Each Pipeline

| Situation | Command |
|-----------|---------|
| New feature (any size) | `/pipeline feature-workflow` |
| Bug fix | `/pipeline feature-workflow` |
| Quick config change | `/pipeline analyze-task` → `/pipeline implement-plan` (skip if trivial) |
| Code review needed | `/pipeline review-diff` |
| Concerned about production risk | `/pipeline qa-check` |
| After delivery — persist lessons | `/pipeline memory-write` |
| Context growing too large | `/pipeline tokenscope` |

---

## Agent Files (Loaded Automatically)

| Agent | File | When Active |
|-------|------|-------------|
| Architect | `.opencode/agents/architect.md` | analyze-task pipeline |
| Executor | `.opencode/agents/executor.md` | implement-plan pipeline |
| Test Engineer | `.opencode/agents/test-engineer.md` | write-tests pipeline |
| Reviewer | `.opencode/agents/reviewer.md` | review-diff pipeline |
| QA Validator | `.opencode/agents/qa-validator.md` | qa-check pipeline |

---

## Memory

Project memory lives in `opencode.md` (root). It is updated automatically by `memory-write`.

To manually add a lesson or decision:
```
Append to the relevant section in opencode.md under Section 12.
Format: [DATE] DECISION/BUG/RULE: ...
```

---

## Rules That Are Always Enforced

- Architect runs BEFORE any code is written
- Blocking questions PAUSE the pipeline — answer before continuing
- CRITICAL risk PAUSES for explicit approval
- Reviewer FAIL sends back to Executor (max 1 retry)
- QA FAIL sends back to Architect (not Executor — it's a plan problem)
- Tests are NEVER skipped — no exceptions
- Memory is written AFTER every successful QA pass
- Booking/payment/ZATCA/auth changes are always HIGH or CRITICAL risk

---

## Commit Rules (After Workflow Completes)

```bash
# One system per commit
git add backend/src/modules/bookings/  # backend only
git commit -m "fix(bookings): block booking when patient has unresolved no-show"

# Separate commit for tests
git add backend/src/modules/bookings/tests/
git commit -m "test(bookings): regression coverage for no-show block logic"
```

Format: `feat|fix|refactor|test|docs(module): description`
Max: 10 files or 500 lines per commit.
