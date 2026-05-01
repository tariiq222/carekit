# Path Playbook — Maestro v10 (Deqah)

This file is **guidance, not law**. It only applies when you have explicitly opted into Maestro for a task (see `MAESTRO.md`). Most Deqah work runs through superpowers skills on plain feature branches and never hits this playbook.

When you *do* run Maestro, every request routes to one of three paths — each with a target budget, suggested agents, and an SLA. Fahad uses these as heuristics, not hard contracts.

---

## Signals → Path Decision Table

| Signal | FAST | STANDARD | DEEP |
|--------|:----:|:--------:|:----:|
| Question / docs only | ✅ | — | — |
| Typo / one-liner fix | ✅ | — | — |
| Single file, < 50 lines | ✅ | — | — |
| 2–5 files, single layer (backend OR dashboard OR mobile) | — | ✅ | — |
| New endpoint, clear spec, one module | — | ✅ | — |
| Bug with clear root cause | — | ✅ | — |
| Scoped refactor within one module | — | ✅ | — |
| Multi-file, multi-layer (e.g. backend + dashboard + mobile) | — | — | ✅ |
| Prisma schema change (split schemas under `apps/backend/prisma/schema/`) | — | — | ✅ |
| Owner-only module touched (auth / payments / ZATCA / migrations / schema / CODEOWNERS) | — | — | ✅ |
| Feature spanning 6+ files | — | — | ✅ |
| Migration (data or structural) | — | — | ✅ |
| Architectural decision needed | — | — | ✅ |
| Ambiguous scope | — | — | ✅ |
| Page Anatomy law change on dashboard lists | — | — | ✅ |

---

## FAST Path ⚡

### When
Trivial, isolated, low-risk tasks. Edit in place, commit direct.

### Budget
- **Total tokens:** 5,000–15,000
- **Target cost:** < $0.05 per task
- **Target time:** < 1 minute

### Agents Involved
- **Yazid (Router)** — classifies (~200 tokens)
- **Fahad (Maestro)** — brief supervision only
- **One Sonnet agent** — does the work directly

### Skipped
- ❌ Sultan (no discovery)
- ❌ Rashed (no architecture)
- ❌ Abdullah (no security review)
- ❌ Omar (no retrospective)
- ❌ Worktree (edit in place)
- ❌ Kiwi sync (FAST tasks skip the QA trail)

### Flow
```
Request → Yazid → Fahad → [Nawaf | Khaled | Salem] → Majed (type-check) → Deliver
```

### Git Strategy
- Edit in place on current branch
- Commit message: `fix: …` or `docs: …` (conventional)
- ≤ 10 files / ≤ 500 lines / one system only — same Deqah commit rules apply

### Examples
- "Fix typo in error message on `apps/dashboard/app/(dashboard)/bookings/page.tsx`"
- "Add JSDoc to `createBooking`"
- "What does this regex in `apps/backend/src/common/guards/` do?"
- "Rename variable `usr` to `user` in one file"

---

## STANDARD Path 🏃

### When
Real features but well-scoped. Single responsibility, clear spec, one layer or one module.

### Budget
- **Total tokens:** 30,000–80,000
- **Target cost:** $0.30–$0.80 per task
- **Target time:** 5–15 minutes

### Agents Involved
- **Yazid (Router)** — classifies
- **Fahad (Maestro)** — plans + reviews
- **Sultan (Explorer)** — **scoped** 5K-token scan
- **2–3 Sonnet agents** — execute
- **Majed** — type-check + lint
- **Saad** — unit + integration tests + Kiwi sync

### Skipped
- ❌ Rashed (unless schema change detected mid-flight → upgrade to DEEP)
- ❌ Abdullah (unless owner-only module touched → upgrade to DEEP)
- ❌ E2E tests (unless UI-facing critical path)
- ❌ Full worktree (use feature branch)

### Flow
```
Request → Yazid → Fahad classify
                     ↓
                  Sultan (scoped)
                     ↓
                  Fahad plan (max 3 subtasks)
                     ↓
                  Execute in parallel
                     ↓
                  Majed + Saad gates (+ Kiwi sync)
                     ↓
                  Fahad review → Deliver
```

### Git Strategy
- New feature branch: `feat/[short-name]` or `fix/[short-name]`
- Work in main workspace (no worktree)
- Commit per logical unit — one system per commit, ≤ 10 files / ≤ 500 lines
- PR to main when done

### Commands You'll Run
```bash
npm run typecheck                  # per workspace or via turbo
npm run lint
npm run test --workspace=backend   # Jest
npm run test --workspace=dashboard # Vitest
npm run test:kiwi                  # sync the run to Kiwi (domain plan)
```

### Examples
- "Add pagination to `GET /bookings`"
- "Extract email validation to `packages/shared`"
- "Add loading skeleton to `BookingCard` on the dashboard"
- "Fix N+1 in `listClients` query"
- "Add a new StatCard to the services list page"

---

## DEEP Path 🏔️

### When
Big features, architectural changes, anything risky or ambiguous, **or any owner-only module** (payments, ZATCA, auth, migrations, schema, CODEOWNERS). Full professional pipeline.

### Budget
- **Total tokens:** 150,000–500,000
- **Target cost:** $3–$15 per task
- **Target time:** 30 minutes – 2 hours

### Agents Involved
- **Yazid (Router)** — classifies
- **Fahad (Maestro)** — orchestrates throughout
- **Sultan (Explorer)** — **full** 20K-token scan
- **Rashed (Architect)** — designs Prisma split-schema changes / OpenAPI contracts
- **Fahad → User** — clarify ambiguities before planning
- **All relevant Sonnet agents** — execute in parallel
- **Majed + Saad** — full gate suite (unit + integration + E2E + Kiwi)
- **Abdullah (Security)** — mandatory review (owner-only ticks every box)
- **Omar (Historian)** — retrospective + changelog + Kiwi roll-up

### Flow
```
Request → Yazid → Fahad classify
                     ↓
                  Sultan (full scan, 20K budget)
                     ↓
                  Fahad → User (clarify if ambiguities)
                     ↓
                  Rashed (architecture + ADR) — if schema / API contract
                     ↓
                  Fahad plan (full decomposition)
                     ↓
                  Create git worktree (use superpowers:using-git-worktrees)
                     ↓
                  Execute (parallel where possible)
                     ↓
                  Full gate suite (type + lint + unit + int + E2E + Kiwi)
                     ↓
                  Abdullah (security review)
                     ↓
                  Fahad review → Omar retro → PR → Deliver
```

### Git Strategy — Worktree Required
```bash
# Fahad creates an isolated worktree at ../deqah-feat-<slug>
cd /Users/tariq/code/deqah
git worktree add ../deqah-feat-waitlist -b feat/waitlist-v2 main

cd ../deqah-feat-waitlist

# Independent environment:
npm install                          # own node_modules
cp .env.example .env                 # own env
# Override: DATABASE_URL=postgresql://localhost/deqah_feat_waitlist
# Override: PORT=<pick a free port in 5000–5999>  (no fixed worktree port table anymore)
npx prisma migrate dev               # against worktree's own DB

# Work happens here without touching main workspace
git push origin feat/waitlist-v2
gh pr create --title "feat(bookings): waitlist v2" --body "…"

# After merge:
cd /Users/tariq/code/deqah
git worktree remove ../deqah-feat-waitlist
git branch -d feat/waitlist-v2
```

### Why Worktree for DEEP
1. **Parallel safety** — you can work on another task in the main workspace
2. **Clean rollback** — if it goes wrong, delete the worktree
3. **Isolated deps** — testing different package versions
4. **Fresh DB state** — migrations don't pollute dev DB (keeps `deqah` DB clean)
5. **Reviewer can `cd` into it** — test locally before merging

### Examples
- "Add waitlist feature with priority + FCM notifications"
- "Migrate auth from JWT to refresh-token rotation"
- "Wire ZATCA e-invoice generation to Moyasar webhook confirmations"
- "Redesign subscription tier pricing + Moyasar checkout"
- "Apply the Page Anatomy law to the reports list page (breaking layout change)"

---

## Budget Enforcement

Fahad tracks spend live and halts if exceeded:

```
if tokens_used > budget * 1.2:
  halt_execution()
  report_to_user("Budget exceeded, halting")
  options:
    - [A] Approve overage (user confirms)
    - [B] Abort (save partial work to branch)
    - [C] Split task (divide remaining scope)
```

## Tier Upgrade Policy

Sometimes the Router is wrong. Fahad can upgrade mid-flight:

| Trigger | Action |
|---------|--------|
| Sultan finds unexpected breakage | FAST → STANDARD |
| Discovery reveals Prisma schema change | STANDARD → DEEP |
| Abdullah flags security / owner-only risk | Add Abdullah review to any path |
| User clarification reveals bigger scope | Restart at higher path |
| Playwright / fake test utilities appear in diff | Halt, ask user (Playwright was removed 2026-04-16) |

**Downgrades are rare and require user confirmation.**

## Cost Accountability

Every delivery ends with a cost summary:

```
## 💰 Budget Report
- Path: DEEP
- Tokens used: 287,453 / 500,000 budget
- Cost: ~$4.82
- Time: 1h 23min
- Agents invoked: Yazid, Sultan, Fahad, Rashed, Nawaf, Khaled, Saad, Majed, Abdullah, Omar
- Kiwi URLs: /plan/<id>/  ·  /runs/<id>/
```

This keeps token usage visible and forces honest self-assessment.
