# CTO Full Orchestration — Design Spec

**Date:** 2026-04-10  
**Branch:** fix/recurring-service-validation  
**Status:** Approved

---

## Problem

الـ CTO pipeline يوقف عند QA PASS. git-manager كان `mode: primary` — مستقل، خارج سلطة CTO. لا commit ولا PR تلقائي.

## Goal

CTO يستلم المهمة ويكمل end-to-end بدون أي توقف:
```
analyze → implement → test → review → qa → commit+PR → done
```

الوحيد اللي يوقف الـ pipeline: `/نوقف` من المستخدم أو PR تم إنشاؤه.

---

## Changes

### 1. `opencode.json`
- `git-manager.mode`: `primary` → `subagent`
- `git-manager.hidden`: `false` → `true`

### 2. `.opencode/agents/cto.md`
- Pipeline: يضاف `commit+PR` stage بعد QA PASS
- Routing: CTO يوجّه لـ git-manager بعد QA PASS تلقائياً
- Auto-continuation: كل الـ hard stops تُزال إلا:
  - `/نوقف` (user command)
  - PR URL جاهز (pipeline complete)
  - git commit فشل مرتين (الوحيد اللي ما نقدر نكمل بدونه)
- Stage handoff separator: يُحذف
- CRITICAL / escalation / blocking_questions / failures: تُعالج داخلياً مع توثيق، تكمل

### 3. `.opencode/agents/git-manager.md`
- يُضاف Input Format رسمي (يستقبل من CTO)
- يُضاف Output Format (يُرجع commit_sha + pr_url للـ CTO)
- PR: يُنشأ دائماً (ليس فقط عند طلب المستخدم)
- السلوك المستقل يُزال — يعمل فقط عند استدعاء CTO

---

## Hard Stops (Final)

| Condition | Action |
|-----------|--------|
| `/نوقف` | STOP — يحفظ الحالة |
| PR URL جاهز | STOP — pipeline اكتمل |
| git commit فشل 2x | STOP — يعرض الخطأ |

## Internal Handling (No Stop)

| Condition | Action |
|-----------|--------|
| `CRITICAL` risk | يوثّق ويكمل |
| `escalation_recommended` | يوجّه لـ architect-opus ويكمل |
| `blocking_questions` | architect يختار أفضل تقدير ويوثّق ويكمل |
| REVIEWER FAIL 2x | يوثّق ويكمل |
| QA FAIL 2x | يوثّق ويكمل |
| git commit فشل 1x | يعيد المحاولة تلقائياً |
