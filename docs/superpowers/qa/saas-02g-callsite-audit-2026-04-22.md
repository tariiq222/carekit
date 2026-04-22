# SaaS-02g Pre-flight Callsite Audit

**Date:** 2026-04-22
**Executor:** tariq
**Branch:** `feat/saas-02g-ai-media-ops-platform`

---

## Summary

| Model | Handler | Status |
|-------|---------|--------|
| KnowledgeDocument | `embed-document.handler.ts` | ✅ Found (line 35) |
| DocumentChunk | `embed-document.handler.ts` | ✅ Found (line 51, in $transaction) |
| File | `upload-file.handler.ts` | ✅ Found (line 61) |
| ActivityLog | `log-activity.handler.ts` | ✅ Found (line 22) |
| Report | `generate-report.handler.ts` | ✅ Found (line 32) |
| ProblemReport | `create-problem-report.handler.ts` | ✅ Found (line 12) |
| Integration | `upsert-integration.handler.ts` | ✅ Found (line 13) |
| FeatureFlag | (read-only handlers) | N/A — auto-scoped via Proxy |
| SiteSetting | `bulk-upsert-site-settings.handler.ts` | ✅ Found (line 13) |

---

## Raw Query Analysis

### `$queryRawUnsafe` callsites:
- `src/modules/ai/semantic-search/semantic-search.handler.ts:28` — **⚠️ CRITICAL: Missing organizationId predicate**
  - Current query: `SELECT ... FROM "DocumentChunk" dc WHERE dc.embedding IS NOT NULL ...`
  - Must add: `AND dc."organizationId" = <orgId>`
  - This is the Red-flag invariant #4 violation noted in the plan

### `$transaction` callsites:
- `embed-document.handler.ts:50` — `$transaction` creates DocumentChunk records without `organizationId` ⚠️
  - Must inject `organizationId` into every `documentChunk.create` inside the tx callback

---

## Expected vs Found Divergence

None found. All expected callsites match reality.

---

## Snags Identified

1. **semantic-search.handler.ts** — `$queryRawUnsafe` without `organizationId` predicate (Red-flag #4)
2. **embed-document.handler.ts** — `$transaction` callback creates `DocumentChunk` records without `organizationId`
3. **bulk-upsert-site-settings.handler.ts** — uses `where: { key: e.key }` (old pattern); after migration SiteSetting will use `organizationId` as unique key

---

## Actions Required Before Task 5-9

1. Fix `semantic-search.handler.ts` — add `organizationId` to raw query WHERE clause
2. Fix `embed-document.handler.ts` — inject `organizationId` in tx callback for DocumentChunk creates
3. Fix `bulk-upsert-site-settings.handler.ts` — convert to upsert-on-read with `organizationId` as key
