# CareKit Agent and Skill Map

## Purpose

This file defines the active lightweight operating model for CareKit.

Rules:

- local skills live in `.agents/skills`
- agent definitions live in `.claude/agents`
- do not duplicate new skills under `.claude/skills`
- `frontend-architect` remains a specialist advisor, not a primary owner

## Active Skills

| Skill | Purpose | Use When |
|---|---|---|
| `carekit-maestro` | source-of-truth, drift, ownership, change classification | task spans layers or shared contracts |
| `carekit-backend` | NestJS + Prisma + Swagger + migration discipline | task is inside `backend/` |
| `carekit-dashboard` | dashboard architecture and implementation rules | task is inside `dashboard/` |
| `carekit-mobile` | Expo Router, theme, services, auth storage | task is inside `mobile/` |
| `carekit-ai` | chatbot, RAG, streaming, receipt verification | task is inside chatbot or AI modules |
| `carekit-ds` | dashboard visual system and UI compliance | any dashboard UI work |

## Active Agents

| Agent | Owns | Mandatory Skill Load |
|---|---|---|
| `maestro` | orchestration and review | `carekit-maestro` |
| `backend-dev` | `backend/**` | `carekit-backend` |
| `dashboard-dev` | `dashboard/**` | `carekit-dashboard`, then `carekit-ds` for UI |
| `mobile-dev` | `mobile/**` | `carekit-mobile` |
| `ai-engineer` | `backend/src/modules/chatbot/**`, `backend/src/modules/ai/**` | `carekit-ai` |
| `qa-engineer` | tests only | `carekit-maestro` plus domain context |

## Specialist Support

| Specialist | Role |
|---|---|
| `frontend-architect` | used by `dashboard-dev` for new large pages, structural redesigns, or complex component blueprints |

## Deferred Roles

These are intentionally not active in phase one of the operating model:

- `devops`
- `design-lead`

They can be added later if the workload justifies the maintenance cost.

## Source of Truth Policy

### Governance truth

1. `AGENTS.md`
2. `CLAUDE.md`
3. explicit user instructions

### Runtime truth

1. package manifests and active config
2. source code
3. schema, migrations, shared contracts
4. tests
5. docs

If runtime behavior and docs conflict, trust runtime first and classify the mismatch as drift.

## Drift Policy

| Drift Type | Meaning | Action |
|---|---|---|
| `doc_lag` | docs outdated, runtime coherent | continue and update docs target later |
| `contract_drift` | shared contract divergence | stop and align owner decisions |
| `architecture_drift` | implementation diverged from planned design | continue only if runtime is clearly established |
| `high_risk_drift` | auth, money, schema, or infra ambiguity | stop and orchestrate |

## Shared and High-Risk Areas

These always require maestro orchestration before editing:

- `shared/**`
- `backend/prisma/schema/**`
- `backend/prisma/migrations/**`
- root `package.json`
- shared tokens and cross-app translation contract structure
- any backend contract consumed by more than one app

## Change Classification

| Class | Meaning | Example |
|---|---|---|
| local | one owner, one layer, no shared contract change | dashboard layout fix |
| cross-layer | affects multiple owners or consumers | DTO change used by dashboard and mobile |
| high-risk | touches schema, auth, money, permissions, or deployment-critical behavior | payment verification or migration work |

## Compatibility Note

`carekit-ds` currently exists in both `.agents/skills` and `.claude/skills` because older project guidance already references the `.claude` path.

Effective rule going forward:

- all new skills are created only under `.agents/skills`
- `.claude/skills/carekit-ds` is treated as a legacy compatibility copy until older references are normalized
