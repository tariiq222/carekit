# Re-test #2 — Phase 2 fixes verification (2026-04-24, round 2)

## Summary

| Bug | Status | Notes |
|-----|--------|-------|
| 7b (list rating column) | ✅ **FIXED** | د. خالد السبيعي now shows "5.0" in the rating column. |
| 7a (detail page avg) | ✅ **FIXED** | Hero now shows "5.0 · متوسط التقييم". API returns `averageRating: 5`. |
| 7a (detail page ratingCount) | 🟡 **NEW regression — frontend only** | Hero shows "0 تقييم" though API returns `ratingCount: 2`. |

## 🐛 BUG #7a-bis — Detail page reads wrong field for ratingCount

### Severity: **LOW** (visible contradiction; average shows but count shows 0)

### Evidence

**API response for `GET /api/v1/dashboard/people/employees/00000000-0000-4000-8000-000000000003`:**
```json
{
  "id": "00000000-0000-4000-8000-000000000003",
  "name": "د. خالد السبيعي",
  ...
  "averageRating": 5,
  "ratingCount": 2,    ← API returns count = 2 (correct)
  "exceptions": []
}
```

**UI on `/employees/[id]`:** hero cards read:
- "5.0" · "**0** تقييم"   ← count is wrong
- Banner: "متوسط التقييم · **0** تقييم"
- Result: user sees an average of 5.0 with zero reviews next to it (logical contradiction).

### Root cause

`apps/dashboard/components/features/employees/employee-detail-page.tsx` reads the wrong field. It still points at the old `p._count?.ratings` shape instead of the flat `p.ratingCount` field that the backend now returns.

Three call sites to fix in the same file:

```
Line 148:   {p._count?.ratings ?? 0} {t("employees.detail.reviews")}
Line 165:   description={`${p._count?.ratings ?? 0} ${t("employees.detail.reviews")}`}
Line 236:   totalRatings={p._count?.ratings ?? 0}
```

Also line 153 & 171 read `p._count?.bookings` for total bookings — check whether the backend now returns `bookingCount` (flat) or a `_count` object; if the former, line 153/171 should also migrate.

### Fix

Replace `p._count?.ratings ?? 0` with `p.ratingCount ?? 0` on lines 148, 165, and 236. If bookings have a similar rename on the backend, do the same for `p.bookingCount` on lines 153 & 171.

### Why it was missed

The backend Bug 7a fix renamed the response shape from nested `{ _count: { ratings, bookings } }` to flat `{ ratingCount, bookingCount }` (or at least for `ratingCount`), and the detail page frontend wasn't updated to match. The list column (Bug 7b) was already reading `averageRating` directly so it caught up without changes.

### Verification snippet (after fix)

Expected hero after fix:
- "5.0" · "**2** تقييم"
- Banner: "متوسط التقييم · **2 تقييم**"

---

## Conclusion

**5 of 5 Phase 2 bugs are now resolved or nearly-resolved.** One tiny frontend follow-up on the detail page to align with the new API shape — no server work needed.

Ready to proceed to **Phase 3 — Bookings** once this last polish is done (or we can move on and batch it with later polish).
