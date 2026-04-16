# Single-Organization Mode — Plan Index

**Parent plan:** [`../2026-04-16-single-organization-mode.md`](../2026-04-16-single-organization-mode.md) — keeps the original 31-task breakdown and progress log. This folder splits it into 7 session-sized plans.

**Current branch:** `feat/single-organization-mode` (based on `backup/pre-tenant-removal`, both pushed to origin).

**Progress as of 2026-04-16:** Tasks 1-4 of parent plan already done on the branch (commits `2fdb874`, `c1f9c74`, `1c84931`, `c368de5`). The 7 plans below cover everything remaining.

---

## The 7 Plans

| Plan | Title | Scope | Est. time |
|---|---|---|---|
| **A** | [Common Layer Preparation](plan-a-common-layer-prep.md) | Relocate `@UserId` decorator; update 28 controller imports | 30 min |
| **B** | [Handler Cleanup Part 1](plan-b-handler-cleanup-part1.md) | Clusters: identity, people, org-config, org-experience (non-singleton), bookings | 2-3 hrs |
| **C** | [Handler Cleanup Part 2](plan-c-handler-cleanup-part2.md) | Clusters: finance, comms, ai (non-chatbot-config), ops, media, platform (+ delete license) | 2-3 hrs |
| **D** | [Singletons + Initial Migration](plan-d-singletons-and-migration.md) | Convert BrandingConfig, OrganizationSettings, ChatbotConfig, ZatcaConfig to singletons; generate ONE migration | 1.5 hrs |
| **E** | [Infrastructure Teardown](plan-e-infrastructure-teardown.md) | Delete `common/tenant/` folder; unwire `TenantMiddleware`; slim `RequestContext` | 30 min |
| **F** | [Clients + Packages Cleanup](plan-f-clients-and-packages.md) | Dashboard + Mobile + Packages: remove `X-Tenant-ID` header, `TENANT_ID` env, tenant types; simplify public branding route | 1.5 hrs |
| **G** | [Finalization](plan-g-finalization.md) | Seed rewrite; CLAUDE.md updates; full E2E verification; Chrome DevTools MCP QA | 1-2 hrs |

**Total:** ~9-12 hours of focused work across 5-7 sessions (fewer if some plans run in parallel — see matrix below).

---

## 🔀 Execution Matrix — What Runs Serial, What Runs in Parallel

### Legend

| Symbol | Meaning |
|---|---|
| 🟢 | Safe in parallel |
| 🔴 | Must serialize (conflicts or dependencies) |
| ⚫ | Not applicable (plan completed / not yet planned) |

### Parallelism Matrix

|        | A  | B  | C  | D  | E  | F  | G  |
|--------|----|----|----|----|----|----|----|
| **A**  | —  | 🔴 | 🔴 | 🔴 | 🔴 | 🟢 | 🔴 |
| **B**  | 🔴 | —  | 🟢* | 🔴 | 🔴 | 🟢 | 🔴 |
| **C**  | 🔴 | 🟢* | —  | 🔴 | 🔴 | 🟢 | 🔴 |
| **D**  | 🔴 | 🔴 | 🔴 | —  | 🔴 | 🟢** | 🔴 |
| **E**  | 🔴 | 🔴 | 🔴 | 🔴 | —  | 🟢 | 🔴 |
| **F**  | 🟢 | 🟢 | 🟢 | 🟢** | 🟢 | —  | 🔴 |
| **G**  | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | —  |

**🟢\* B ‖ C:** Only if EACH session uses its own sub-branch (`feat/single-org-B-part1` and `feat/single-org-C-part2`), then merged back to `feat/single-organization-mode` sequentially afterward (B first, then C). They touch different clusters but might share edits to `app.module.ts` or shared types.

**🟢\*\* F ‖ D:** Technically safe (F is frontend + one public controller, D is schema + backend handlers), but strongly recommended to serialize so that when Plan D makes breaking handler signature changes, Plan F's public branding route refactor (Task F7) doesn't get blocked mid-session. If you parallelize, do F1-F6 now and defer F7 until after D completes.

### Dependency Chain (the safe, serial path)

```
A  →  B  →  C  →  D  →  E  →  F  →  G
```

This is the simplest, safest order. Zero conflicts guaranteed. ~9-12 hours total across sessions.

### Speed-Optimized Path (uses parallelism)

```
Session 1:   A  (alone, 30 min)
Session 2+3: B ‖ C  (each on its own sub-branch, ~3 hrs each)
              ↓ merge both into feat/single-organization-mode
Session 4:   D  (alone, 1.5 hrs)
Session 5:   E  (alone, 30 min)
Session 6:   F  (can start in session 2/3 as side thread, ~1.5 hrs)
Session 7:   G  (alone, 1-2 hrs)
```

If you run 2 people (or 2 Claude sessions) on parallel sub-branches: saves ~2-3 hours.

### Common Patterns

- **Plan F is the only plan that parallelizes freely with backend work**, because it touches frontend + packages + one isolated public controller.
- **Plan G must ALWAYS be serial and last** — it's the verification gate.
- **Plans that change schema (D) or structural backend (A, E) must NEVER run concurrently with any other backend plan** — they invalidate assumptions.

---

## ⏸️ Interruption Rules (Applies to ALL plans)

Every plan contains this contract, repeated here for clarity:

1. **If a session stops mid-plan for any reason** (context limit, error, user interruption):
   - STOP. Do NOT start the next plan.
   - The next session resumes the same plan from the first uncompleted checkbox.
   - The plan must reach its final ✅ before any dependent plan may start.

2. **If you finished a cluster in Plan B/C/D and want to stop**: you MAY stop between clusters as long as the cluster is committed. Next session resumes from the next cluster.

3. **No "close enough"**: every plan has a completion contract listed at the top. If any check fails, the plan is NOT done, regardless of how many tasks are checked off.

4. **No skipping**: if Plan B Task B3 fails, don't skip to B4. Fix B3 first.

5. **Plan G is the final gate.** If anything in Plan G fails, the work is NOT ready to merge. Root-cause and fix before signing off.

---

## 📋 Quick Reference: How to Resume Any Session

Start of any new session on this refactor:

```bash
cd c:\pro\carekit
git branch --show-current         # should be feat/single-organization-mode (or a sub-branch)
git log --oneline | head -15       # see what's done
git status --short                 # should be clean

# Figure out where you are:
# - Check docs/superpowers/plans/single-organization-mode/README.md (this file)
# - Read the progress log section in docs/superpowers/plans/2026-04-16-single-organization-mode.md
# - Check memory: ~/.claude/projects/c--pro-carekit/memory/single_org_mode_progress.md
```

Then pick the next plan per the dependency chain.

---

## 🔗 Related Files

- [Parent plan (original 31-task document)](../2026-04-16-single-organization-mode.md)
- [Plan A — Common Layer Preparation](plan-a-common-layer-prep.md)
- [Plan B — Handler Cleanup Part 1](plan-b-handler-cleanup-part1.md)
- [Plan C — Handler Cleanup Part 2](plan-c-handler-cleanup-part2.md)
- [Plan D — Singletons + Initial Migration](plan-d-singletons-and-migration.md)
- [Plan E — Infrastructure Teardown](plan-e-infrastructure-teardown.md)
- [Plan F — Clients + Packages Cleanup](plan-f-clients-and-packages.md)
- [Plan G — Finalization](plan-g-finalization.md)
