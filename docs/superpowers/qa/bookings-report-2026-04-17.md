# تقرير اختبار QA — صفحة الحجوزات

> **Date:** 2026-04-17
> **Tester:** Claude (Chrome DevTools MCP manual QA gate)
> **Plan:** [bookings.md](./bookings.md)
> **Branch:** `main`
> **Screenshots:** [screenshots/bookings/](./screenshots/bookings/)

## Verdict

🔴 **NOT READY TO MERGE.** The bookings page is broken across the core user flows — list table, detail sheet, create wizard, and cancel dialog all fail in ways that block primary use cases. 10+ blockers identified in the first 30 minutes of testing. The rest of the QA plan (StatsGrid, pagination, edge cases, RTL Dark Mode polish, recurring bookings, timezone drift) was not fully exercised because the foundational rendering is non-functional.

---

## Environment

- Backend `:5100` ✅ healthy — seeded via `npm run seed` + custom `prisma/demo-seed.ts` (3 employees, 3 services, 3 clients, 12 bookings across 8 statuses).
- Dashboard `:5103` ✅ healthy — logged in as `admin@deqah-test.com` via Dev Admin Login.
- Postgres on `:5999` (docker `deqah-postgres`), Redis up, MinIO/FCM/OpenAI disabled (warnings only).

---

## Blocker findings (must fix before re-test)

### B1 🔴 List table renders all relational columns as `—`

Every row shows:

| المريض | الممارس | النوع | التاريخ والوقت | المبلغ |
|:-:|:-:|:-:|:-:|:-:|
| — | — | — | (missing) | (missing) |

Only `#` (booking id) and the status badge render. Screenshot: `list-light-rtl.png`.

**Root cause (from network trace, reqid=129):** `GET /api/v1/dashboard/bookings?page=1&limit=20` returns **flat scalars only** — `clientId`, `employeeId`, `serviceId`, `scheduledAt`, `bookingType`, `price`, `durationMins` — with **no embedded `client/`, `employee/`, or `service/` relations**. The dashboard's table is clearly coded to read `row.client.name`, `row.employee.name`, `row.service.nameAr`, etc., which all resolve to `undefined` → rendered as `—`.

Two possible fixes — pick one:
1. Include relations in `ListBookingsHandler`: `prisma.booking.findMany({ include: { client: true, employee: true, service: true } })`.
2. Project a DTO shape on the backend that matches the UI contract.

Either way, the list contract is broken end-to-end.

---

### B2 🔴 Even the **flat** scalars that *are* in the response are not rendered

`scheduledAt`, `price`, `currency`, `durationMins`, `bookingType` all come back in the payload (verified via `get_network_request` on reqid=129) but none of them appear in the UI — the date/time, amount, and type columns are all `—`. So this is not only a "missing include"; the column renderers themselves are broken. Expect every table cell except `id` and `status` to need fixes.

---

### B3 🔴 Status badges show raw enum identifiers in English on an Arabic UI

Rendered values: `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`, `EXPIRED`, `AWAITING_PAYMENT`, `CANCEL_REQUESTED`.

QA spec requires localized Arabic labels + semantic coloring. The i18n map must be filled in (likely `hooks/use-booking-status-label.ts` or the `BookingStatusBadge` component).

---

### B4 🔴 BookingDetailSheet is completely broken

Clicking "عرض التفاصيل" opens the sheet with:
- Title shows status as literal `"Unknown"` next to `"PENDING"` badge
- "المستفيد", "الممارس", "الموعد" all show `—`
- The duration renders literally as `"undefined — undefined"` and `"0 min"` (non-localized, QA requires `ar-SA` formatted)
- "سجل الحالات": "لا توجد تغييرات في الحالة حتى الآن." — but the query that would populate it is **broken** (see B5)
- **No network request is fired** to `GET /dashboard/bookings/:id`. The sheet reads from list row data only → fails because list data has no relations either.

Screenshot: `detail-sheet.png`.

---

### B5 🔴 Status-log query registered with **no queryFn**

Console errors on every detail-sheet open:

```
[["bookings","status-log","bkg-1"]]: No queryFn was passed as an option, and no default queryFn was found.
```

TanStack Query hook is declaring a query key but never providing a fetcher. The status log will never populate. Find `useQuery({ queryKey: ["bookings","status-log", id] ... })` and wire it to an actual endpoint (or delete the hook if no endpoint exists).

---

### B6 🔴 The "حذف الحجز" button is a plain destructive `AlertDialog`, not `AdminCancelDialog`

QA spec §8 requires the cancel flow to capture:
- `cancelReason` (textarea, required)
- `refundType` (dropdown: full / partial / none, required)
- `refundAmount` (number, required when `partial`)
- `adminNotes` (textarea)

Instead, the button opens a shadcn `AlertDialog` with just "هل أنت متأكد من حذف هذا الحجز؟ لا يمكن التراجع عن هذا الإجراء." + [إلغاء][حذف] buttons. **The entire refund capture is missing from the UI.** Any cancellation will happen without refund metadata, which is a finance risk.

Screenshot: `cancel-dialog-validation.png`.

Also the label "حذف الحجز" (Delete booking) is wrong for a cancel operation — it should say "إلغاء الحجز".

---

### B7 🔴 Create-booking wizard dead-ends at step 4 (نوع الحجز)

Walked the wizard: Client → Service → Employee → **Step 4 "النوع والمدة"**. The step renders only the heading "نوع الحجز" and a "تغيير المستفيد" shortcut — **no type buttons (`in_person / online / walk_in`) are rendered**. There is no way to proceed to date/time or confirm, so **no booking can be created from the dashboard at all** right now.

Likely cause: the `availableTypes` that drive the type buttons rely on service or booking-settings fields that aren't populated. The wizard must guard against empty-types and at minimum show an inline error instead of a silently empty step.

---

### B8 🔴 Service prices displayed as `1 ر.س` / `2 ر.س` in wizard step 2

Seeded prices: 120, 250, 200 SAR.
Wizard shows: "استشارة جلدية 30 دقيقة · **2 ر.س**", "تنظيف أسنان · **2 ر.س**", "كشف عام · **1 ر.س**".

Price is stored as `Decimal` and arrives as the string `"120"`. The UI formatter appears to read only the first digit (or divide by 100). Check `formatCurrency` / the service-card component in the wizard.

---

### B9 🔴 Search input does not filter the table (server-side or client-side)

Typing `"أحمد"` in FilterBar search fires **zero network requests** (no debounced call to `/bookings?search=...`) and the visible rows don't shrink either. Either the input is not connected to query state or the search is not implemented. QA spec §4.1 explicitly requires "debounced ~300ms, يرسل `search=<value>`".

---

### B10 🔴 Reset button does not refetch or clear state

After applying "اليوم" (fires filtered request correctly) and typing in search, clicking "إعادة تعيين" does **not** fire a `/bookings?page=1&limit=20` without filters. Only the unread-count notification polling runs.

---

### B11 🔴 Pagination "1 من 2" shown while backend says `totalPages: 1`

API returns `{ meta: { total: 12, page: 1, perPage: 20, totalPages: 1 } }`. The UI displays "صفحة 1 من 2" and keeps "التالي" enabled. This suggests the dashboard is computing page count from a hardcoded 10-per-page against a different field — it is not reading `meta.totalPages` from the actual response. Note also that the list endpoint returns `items` (not `data`) and meta fields use `total` / `perPage` (not `totalItems`). QA doc description of the response shape (§3.1, §9) is stale.

---

### B12 🔴 Employee filter in wizard step 3 does not filter by service specialty

With `svc-1` (General) linked only to `emp-1` in `EmployeeService`, the wizard shows **all 3 employees**. QA spec §6.3: "قائمة الموظفين يفلتر تلقائي (موظفين عندهم specialty فقط)". Probably fetching the full employee list instead of the service-compatible subset.

---

### B13 🔴 `#` column shows full id (`bkg-11`) instead of first-8-chars monospace

Small UX issue but explicitly required by QA spec §5.1. Current rendering is just `bkg-11`.

---

### B14 🔴 Slots endpoint mismatch — dashboard calls non-existent path

After B7 was fixed (step 4 removed), stepping into the new step 4 (datetime) fires:

    GET /api/v1/dashboard/people/employees/emp-1/slots?date=2026-04-17 → 404

The backend actually exposes:

    GET /api/v1/dashboard/bookings/availability?employeeId=...&serviceId=...&date=...

The dashboard's `StepDatetime` / fetcher is pointed at a ghost path. Even once an employee has availability configured, the date picker will never show slots. QA doc §6.5 also had the wrong shape (`POST` body instead of `GET` query). Fix: repoint `fetchEmployeeSlots` (or similar) to `/dashboard/bookings/availability` with proper query params.

Screenshot: `wizard-step-datetime-after-b7-fix.png`.

---

## Fix Log

### 2026-04-17 — B7 fixed

Removed step 4 (نوع الحجز + المدة) from the create-booking wizard per user request. Backend already treats `bookingType` as optional (defaults to `INDIVIDUAL`). Changes:

- [booking-wizard.tsx](../../apps/dashboard/components/features/bookings/booking-wizard.tsx) — dropped `StepTypeDuration` render, step total 6 → 5, step title map updated, `handleSubmit` no longer requires/sends `type` or `durationOptionId`.
- [use-wizard-state.ts](../../apps/dashboard/components/features/bookings/use-wizard-state.ts) — `WizardStep` narrowed to `1..5`, removed `type / durationOptionId / durationLabel / selectType / selectDuration / skipDuration`, `selectEmployee` now jumps directly to step 4 (datetime).
- [step-confirm.tsx](../../apps/dashboard/components/features/bookings/wizard-steps/step-confirm.tsx) — removed the booking-type summary row + `getTypeLabel` helper; datetime row's edit button now jumps to step 4.
- [booking.ts](../../apps/dashboard/lib/types/booking.ts) — `CreateBookingPayload.type` is now optional.

Typecheck: clean. Wizard walkthrough verified in browser — flows client → service → employee → datetime (no dead-end). Final submission path blocked only by the unrelated B14 (slots 404).

**Tradeoff:** Dashboard can no longer create `ONLINE` (Zoom) bookings; every new booking from the dashboard defaults to `INDIVIDUAL`.

Small UX issue but explicitly required by QA spec §5.1. Current rendering is just `bkg-11`.

---

## QA doc vs. code drift (documentation debt, not code bugs)

These aren't UI bugs per se — they're places where the QA plan is out of date with the code / DB:

1. **BookingStatus enum.** QA says 9 statuses including `pending_cancellation, checked_in, in_progress`. DB enum actually has: `PENDING, PENDING_GROUP_FILL, AWAITING_PAYMENT, CONFIRMED, CANCELLED, COMPLETED, NO_SHOW, EXPIRED, CANCEL_REQUESTED`. QA plan needs to be rewritten around the real enum.
2. **Endpoint path.** QA curl examples use `http://localhost:5100/dashboard/bookings` — actual path is `/api/v1/dashboard/bookings`.
3. **Response shape.** QA expects `meta.totalItems` / `meta.totalPages` and `data[]`. Actual: `meta.total` / `meta.totalPages` / `meta.perPage` / `hasNextPage` / `hasPreviousPage` and `items[]`.
4. **Backend seed.** `npm run seed` creates only admin + singletons + main branch. There is **no demo seed** with employees/services/clients/bookings. The QA gate needs one (I wrote a temporary `apps/backend/prisma/demo-seed.ts` for this session — it should be promoted into the real seed script or kept as a separate `npm run seed:demo` target).

---

## What I could not test (because blocked)

- **Section 5.2** — inline `pending` confirm/no-show buttons: not visible (only `عرض التفاصيل / تعديل الموعد / حذف الحجز` are rendered on every row, regardless of status — confirm/no-show buttons are absent).
- **Section 5.3** — `ActionsCell` dropdown: there is no dropdown; the three buttons render flat inline.
- **Section 6.5** — availability / date picker step: wizard dies at step 4.
- **Section 6.6** — confirm & POST: wizard dies at step 4.
- **Section 7.3** — reschedule tab fields: detail sheet is broken.
- **Section 8.2–8.5** — all cancel validation + approve/reject flows: dialog is missing.
- **Section 9** — pagination with real data: only 12 rows, and the pagination math is wrong anyway.
- **Section 11.3–11.7** — recurring, timezone drift, stale-dialog red flag, 1000+ rows: would require a functional UI first.
- **Section 14** red flags: couldn't verify most because the relevant UI surfaces don't work.

---

## Required screenshots

Saved in `docs/superpowers/qa/screenshots/bookings/`:

- ✅ `list-light-rtl.png` — shows B1/B2/B3/B13
- ✅ `list-dark-rtl.png` — dark mode list (same bugs as light)
- ✅ `wizard-step1.png` — client search list (actually works)
- ✅ `detail-sheet.png` — shows B4/B5
- ✅ `cancel-dialog-validation.png` — shows B6 (it's not even the right dialog)
- ✅ `pagination.png` — shows B11

Skipped:
- ❌ `wizard-step6.png` — unreachable (B7)
- ❌ `empty-state.png` — search filter doesn't work so can't isolate the empty state

---

## Recommended next steps

1. **Stop and triage list contract first (B1+B2).** Every other surface depends on having a correct list DTO + table renderer. Fix the handler to include relations (or align the UI to the scalar contract) before anything else.
2. **Rewrite QA plan §3 response shape** to match the actual `items[] / meta { total, perPage, totalPages }` contract, and update endpoint paths.
3. **Promote a real demo seed** (bookings + employees + services + clients) so QA is reproducible without ad-hoc scripts.
4. **File separate bug tickets** for B3, B4, B5, B6, B7, B8, B9, B10, B11, B12, B13 — each is independent and can be fixed in parallel.
5. **Only after the list + detail + cancel + wizard work**, re-run this QA plan top-to-bottom.
