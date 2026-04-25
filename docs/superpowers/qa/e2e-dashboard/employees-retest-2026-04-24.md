# Re-test Report — Phase 2 fixes (2026-04-24)

Verification of fixes applied after the initial Phase 2 Employees report.

## Verification results

| # | Bug | Status | Evidence |
|---|-----|--------|----------|
| 3 | Create employee silent failure | ✅ **FIXED** | `POST /api/v1/dashboard/people/employees/onboarding → 201`. New employee "مختبر الجودة" appeared at the top of the list. Total 10→11, active 8→9. |
| 4 | Experience spinbutton `valuemax="0"` | ✅ **FIXED** | a11y snapshot on `/employees/create`: `spinbutton "e.g. 5" valuemax="70" valuemin="0"`. |
| 5 | Email field missing on edit form | ✅ **FIXED** | Edit page now renders email as `textbox readonly value="qa.tester2@carekit-test.com"`. |
| 6 | Stats "غير متاح" vs row "موقوف" label drift | ✅ **FIXED** | Stats card 3 now reads **"موقوف"** (count 2), matching the badge text in each inactive row. |
| 7 | avg rating 4.5 but rating column "—" for all rows | 🛑 **STILL BROKEN** (two regressions) | See below |

---

## 🐛 BUG #7 — still standing (two sub-bugs)

### Subfinding 7a — Employee detail page never fetches ratings

**Where:** `apps/backend/src/modules/people/employees/get-employee.handler.ts`

The handler returns `mapEmployeeRow(employee)` **without** passing ratings as the second argument, so `averageRating` defaults to `null` and `ratingCount` to `0`.

```ts
return {
  ...mapEmployeeRow(employee),   // ← no ratings arg
  exceptions: employee.exceptions,
};
```

**Observed:** Opened `/employees/00000000-0000-4000-8000-000000000003` (د. خالد السبيعي). DB shows this employee has **2 ratings with avg 5.0**, yet detail page hero card displays:

- "—" (where avg should be)
- "0 تقييم"
- "متوسط التقييم · 0 تقييم"

**Fix:** The handler must aggregate ratings the same way `list-employees.handler.ts` does:

```ts
const [employee, ratingAgg] = await Promise.all([
  this.prisma.employee.findFirst({ where: { id: query.employeeId }, include: { ... } }),
  this.prisma.rating.aggregate({
    where: { employeeId: query.employeeId },
    _avg: { score: true },
    _count: { _all: true },
  }),
]);
// ...
return {
  ...mapEmployeeRow(employee, { avg: ratingAgg._avg.score, count: ratingAgg._count._all }),
  exceptions: employee.exceptions,
};
```

### Subfinding 7b — List UI shows "—" in rating column even for employees who have ratings

**Where:** Could be either backend or frontend — needs verification.

**Observed on `/employees` list (with TOTAL=11):**

- Stats card "متوسط التقييم" = **4.5** (correct — matches DB: 4 ratings in default org, avg 4.5).
- Row for "د. خالد السبيعي" (id `00000000-0000-4000-8000-000000000003`) shows "—" in the rating column.
- DB confirms this employee has 2 ratings (both score=5) in org `00000000-0000-0000-0000-000000000001`.

**Expected:** The rating column for that row should show **5.0** with a star icon.

**Probable root causes** (pick the one that matches):

1. **Tenant scoping on `Rating.groupBy`.** If `Rating` is not in `SCOPED_MODELS` (or if `groupBy` doesn't get auto-scoped by CLS middleware), it still *should* return the right rows because the `where: { employeeId: { in: [...] } }` clause restricts to visible employees. But if `groupBy` is receiving no rows (because of CLS context issue), all employees get `undefined` → mapper defaults to `null`.
2. **Array-of-IDs filter returning empty.** Edge case: `items.map((e) => e.id)` may accidentally include the newly created employee, and something in the query rejects the whole batch.
3. **Frontend not consuming `averageRating`.** The RatingDisplay component reads `row.original.averageRating` — verify via DevTools that the list response actually contains this field with a value.

**Diagnostic step for developer:**

Open DevTools → Network on `/employees` → select the `GET /api/v1/dashboard/people/employees?page=1&limit=20` response → inspect the item with `id: "00000000-0000-4000-8000-000000000003"`. If `averageRating` is `null` in the payload, the bug is in `list-employees.handler.ts`. If it's `5`, the bug is in the frontend `RatingDisplay` / column definition.

**DB evidence:**
```
  employeeId (default org only)          | count | avg
  00000000-0000-4000-8000-000000000001   |   2   | 4.0
  00000000-0000-4000-8000-000000000003   |   2   | 5.0
```

Both employees appear on the current list page (page 1 of 2).

---

## Summary

| Severity | Fixed | Remaining |
|----------|-------|-----------|
| HIGH | 1 (create) | 0 |
| MEDIUM | 1 (label drift) | 1 (rating display — split into 7a + 7b) |
| LOW | 2 (valuemax, email field) | 0 |

4 of 5 Phase 2 bugs are fixed. Bug #7 was partly addressed (stats card now shows the correct scoped average) but the per-employee rendering of averageRating remains broken on both the detail page (backend not aggregating) and the list rating column (either backend scope or frontend reading).
