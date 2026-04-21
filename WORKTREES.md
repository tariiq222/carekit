# Worktree Policy — CareKit

Git worktrees let multiple branches exist as separate directories simultaneously. Maestro uses them for **DEEP path** tasks — any significant feature or refactor that touches multiple layers or changes Prisma schema.

---

## Why Worktrees Beat Branches Alone

| Problem with branches | How worktrees solve it |
|-----------------------|------------------------|
| `git checkout` loses uncommitted work | Each worktree has its own working tree |
| Can't run two tasks in parallel | Two worktrees = two separate dirs |
| `node_modules` re-installs on every switch | Each worktree has its own `node_modules` |
| Prisma migrations pollute dev state | Each worktree uses a separate test DB |
| Reviewer can't test locally | They `cd` into the worktree and run it |

---

## Directory Convention

```
/Users/tariq/code/
├── carekit/                         ← main workspace (stays clean)
├── carekit-feat-waitlist/           ← worktree 1 (DEEP task)
├── carekit-feat-zatca/              ← worktree 2 (DEEP task, parallel)
└── carekit-refactor-auth/           ← worktree 3 (DEEP task, parallel)
```

Naming: `carekit-[type]-[kebab-short-name]`

Types: `feat`, `refactor`, `fix` (only for DEEP bugs), `migration`

---

## Port Allocation (CareKit reserves 5000–5999)

Main workspace uses:
- Backend: `5100`
- Mobile (Expo): `5102`
- Dashboard: `5103`
- Website: `5104`

Worktrees start at `5110` and walk up in steps of 10 — each worktree claims a 10-port block:

| Worktree slot | Backend | Mobile | Dashboard | Website |
|---------------|:-------:|:------:|:---------:|:-------:|
| Main workspace | 5100 | 5102 | 5103 | 5104 |
| Worktree 1 | 5110 | 5112 | 5113 | 5114 |
| Worktree 2 | 5120 | 5122 | 5123 | 5124 |
| Worktree 3 | 5130 | 5132 | 5133 | 5134 |

Cap: **3 active DEEP worktrees** per project at any time.

---

## Lifecycle

### 1. Create (Fahad kicks off DEEP task)

```bash
# From main workspace
cd /Users/tariq/code/carekit

# Create branch + worktree in one command
git worktree add ../carekit-feat-waitlist -b feat/waitlist-v2 main

# Move into it
cd ../carekit-feat-waitlist
```

### 2. Bootstrap (once per worktree)

```bash
# Own deps (required — CareKit uses npm workspaces + Turborepo)
npm install

# Own env file (don't inherit main's .env)
cp .env.example .env

# Pick a worktree slot (1, 2, or 3) from the port table above and set:
#   DATABASE_URL=postgresql://localhost/carekit_feat_waitlist
#   PORT_BACKEND=5110
#   PORT_DASHBOARD=5113
#   UPLOAD_DIR=/tmp/carekit-uploads-feat-waitlist
# (Edit the existing env keys — see .env.example for the canonical names.)

# Bring up infra just for this worktree if needed
npm run docker:up

# Own DB
npx prisma migrate dev --schema apps/backend/prisma/schema    # split-schema aware
npm run seed --workspace=backend
```

### 3. Execute (agents work here)

All Sonnet agents operate inside the worktree. Fahad tracks the working directory in the task context.

```bash
# Per-workspace test runs, same as the main workspace
npm run test --workspace=backend
npm run test:e2e --workspace=backend
npm run test --workspace=dashboard         # Vitest

# Sync the run to Kiwi under Product="CareKit", Version="main"
# Build name should include the worktree slug, e.g. "feat-waitlist-local-2026-04-21"
npm run test:kiwi
```

### 4. Sync with main (if main advances)

```bash
cd ../carekit-feat-waitlist
git fetch origin
git rebase origin/main      # preferred; switch to merge only if the team says so
```

If conflicts, Fahad halts execution and asks user.

### 5. Push + PR

```bash
git push origin feat/waitlist-v2
gh pr create --title "feat(bookings): waitlist v2" --body "…"
```

### 6. Cleanup (after merge)

```bash
cd /Users/tariq/code/carekit     # back to main workspace
git worktree remove ../carekit-feat-waitlist
git branch -d feat/waitlist-v2   # delete local branch
# drop the worktree DB once you're sure it's unneeded:
# dropdb carekit_feat_waitlist
```

---

## Concurrent Worktree Rules

### Maximum
- **3 active DEEP worktrees** per project at any time
- More than 3 = confusion, halt and wait

### Conflict Prevention
Before creating a new worktree, Fahad checks active worktrees for overlap:

```bash
git worktree list
```

If two worktrees would touch the same files, Fahad warns:
```
⚠️ Worktree 'feat-waitlist' is modifying apps/backend/src/modules/bookings/
   New worktree 'feat-priority' also targets apps/backend/src/modules/bookings/
   Recommend: finish feat-waitlist first, or sequence the tasks.
```

### Shared Resources
Two worktrees cannot share:
- ❌ DB (each needs its own `DATABASE_URL` — use the `carekit_<slug>` pattern)
- ❌ Port (each needs its own backend/dashboard/mobile ports from the table above)
- ❌ Upload dir (`/tmp/carekit-uploads-<slug>`)
- ❌ Redis namespace (`REDIS_PREFIX=carekit_<slug>_`)
- ❌ MinIO bucket (`MINIO_BUCKET=carekit-<slug>`)

---

## Worktree-per-Project Setup (one-time)

Create a `.worktree-config` in the project root:

```bash
# .worktree-config
WORKTREE_BASE=..
DB_PREFIX=carekit_
PORT_BACKEND_BASE=5110
PORT_DASHBOARD_BASE=5113
PORT_MOBILE_BASE=5112
PORT_STEP=10
UPLOADS_BASE=/tmp/carekit-uploads-
REDIS_PREFIX_BASE=carekit_
MINIO_BUCKET_BASE=carekit-
```

Fahad reads this to auto-generate env values per worktree slot.

---

## When NOT to Use Worktrees

- **FAST path** — edit in place, too small to justify
- **STANDARD path** — feature branch in main workspace is enough
- **Bug fix on current branch** — if you're already on the right branch
- **Documentation-only changes** — no code, no need
- **Dashboard-only cosmetic tweaks** — no migration, no worktree

---

## Emergency: Abandon Worktree

If a DEEP task goes wrong and you want to bail:

```bash
cd /Users/tariq/code/carekit
git worktree remove ../carekit-feat-waitlist --force
git branch -D feat/waitlist-v2

# All work is discarded. Start fresh.
```

Fahad never silently abandons — always asks user first:
```
Task is significantly off-track (tests failing, scope creep detected).
Options:
[A] Keep going, increase budget
[B] Commit what works, mark remaining as TODO
[C] Abandon worktree, revert to pre-task state
```

---

## Cheat Sheet

```bash
# Create
git worktree add ../carekit-feat-X -b feat/X main

# List
git worktree list

# Remove (clean)
git worktree remove ../carekit-feat-X

# Remove (force)
git worktree remove ../carekit-feat-X --force

# Prune stale refs
git worktree prune
```
