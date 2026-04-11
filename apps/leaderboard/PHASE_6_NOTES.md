# Phase 6 — Wiring TODO for parent

Phase 6 (Finance) is frontend-only and consumes existing backend endpoints.
ZATCA is intentionally **deferred** — no UI was built for it in this phase.

To unblock the existing deep-import strategy, this phase added subpath
exports to `packages/api-client/package.json`. The hooks under
`apps/leaderboard/src/hooks/use-{payments,invoices,coupons,gift-cards}.ts`
import directly via those subpaths, e.g.:

```ts
import * as paymentsApi from '@carekit/api-client/payments'
import type { PaymentListQuery } from '@carekit/api-client/types/payment'
```

The parent should consolidate these as documented below.

---

## packages/api-client/src/index.ts — add these exports

```ts
export * as paymentsApi from './modules/payments.js'
export * as invoicesApi from './modules/invoices.js'
export * as couponsApi from './modules/coupons.js'
export * as giftCardsApi from './modules/gift-cards.js'
```

And in `packages/api-client/src/types/index.ts`:

```ts
export type {
  PaymentMethod,
  PaymentStatus,
  PaymentBookingPatient,
  PaymentBooking,
  PaymentInvoice,
  PaymentListItem,
  PaymentStats,
  PaymentListQuery,
  PaymentListResponse,
} from './payment.js'

export type {
  ZatcaStatus,
  InvoicePaymentInfo,
  InvoiceListItem,
  InvoiceStats,
  InvoiceListQuery,
  InvoiceListResponse,
} from './invoice.js'

export type {
  CouponDiscountType,
  CouponStatusFilter,
  CouponListItem,
  CouponListQuery,
  CouponListResponse,
  CreateCouponPayload,
  UpdateCouponPayload,
  CouponStats,
} from './coupon.js'

export type {
  GiftCardStatusFilter,
  GiftCardTransaction,
  GiftCardListItem,
  GiftCardListQuery,
  GiftCardListResponse,
  CreateGiftCardPayload,
  UpdateGiftCardPayload,
  GiftCardStats,
} from './gift-card.js'
```

After wiring, the parent may optionally remove the temporary subpath exports
from `packages/api-client/package.json` and migrate the four hook files to
the canonical `import { paymentsApi } from '@carekit/api-client'` style. Until
then, both styles work.

---

## apps/leaderboard/src/lib/query-keys.ts — add these keys

```ts
payments: {
  all: ['payments'] as const,
  list: (params: Record<string, unknown>) => ['payments', 'list', params] as const,
  stats: ['payments', 'stats'] as const,
  detail: (id: string) => ['payments', id] as const,
},
invoices: {
  all: ['invoices'] as const,
  list: (params: Record<string, unknown>) => ['invoices', 'list', params] as const,
  stats: ['invoices', 'stats'] as const,
  detail: (id: string) => ['invoices', id] as const,
},
coupons: {
  all: ['coupons'] as const,
  list: (params: Record<string, unknown>) => ['coupons', 'list', params] as const,
  detail: (id: string) => ['coupons', id] as const,
},
giftCards: {
  all: ['gift-cards'] as const,
  list: (params: Record<string, unknown>) => ['gift-cards', 'list', params] as const,
  detail: (id: string) => ['gift-cards', id] as const,
},
```

The four hook files currently use inline `KEYS` constants with the same
shape (look for `// TODO: move to QUERY_KEYS when parent wires it up`).
Replace those with `QUERY_KEYS.payments`, etc.

---

## Sidebar entries TODO

| Label             | Icon                  | Path           | Feature flag    |
|-------------------|-----------------------|----------------|-----------------|
| المدفوعات         | hgi-credit-card       | /payments      | (always on; owner-only data) |
| الفواتير          | hgi-invoice-03        | /invoices      | (always on)     |
| الكوبونات         | hgi-tag-01            | /coupons       | `coupons`       |
| بطاقات الإهداء    | hgi-gift              | /gift-cards    | `gift_cards`    |

`coupons` and `gift-cards` backend controllers are gated by
`@RequireFeature('coupons')` / `@RequireFeature('gift_cards')`. The sidebar
should hide these entries when the feature flag is off.

ZATCA entry is **intentionally not added** — deferred to a later phase.

---

## Backend endpoint issues / observations

1. **Invoice stats shape** — the spec asked for "paid / unpaid / overdue",
   but `GET /invoices/stats` actually returns `{ total, sent, pending, zatca }`.
   The list page maps these to "إجمالي / مرسلة / معلقة / ZATCA المرسلة"
   — adjust copy if business wants different semantics.

2. **Payment stats shape** — the spec asked for "successful / failed /
   refunded", but `GET /payments/stats` actually returns
   `{ total, paid, pending, failed, refunded, totalRevenue }`. UI uses
   `paid / failed / refunded` and displays the `total` count.

3. **Coupon and Gift Card list endpoints have NO stats endpoint.** Both
   modules (`/coupons`, `/gift-cards`) only expose paginated list / detail
   / CRUD. The list pages compute stats client-side from the current page
   of items (active / expired / depleted / total). This is approximate —
   when server-side stats endpoints are added later, swap to those.
   *(Note: the StatsGrid `total` card uses `meta.total` so it is accurate
   across pages, but `active`/`expired` are page-local.)*

4. **Payments search** — `PaymentFilterDto` does NOT support a `search`
   parameter. The list page filters client-side on the current page by
   `transactionRef` / `moyasarPaymentId` / `id`. If a backend search field
   becomes available, swap to it.

5. **Invoices search** — `InvoiceFilterDto` accepts `search` (by invoice
   number or patient name). Wired.

6. **Invoice HTML endpoint** — `GET /invoices/:id/html` returns raw HTML
   (`Content-Type: text/html`), not JSON. The api-client provides a
   `getHtmlPath(id)` helper that returns the relative path; the detail
   page combines it with `import.meta.env.VITE_API_BASE_URL` to embed it
   inside an `<iframe>`. **Note:** the iframe loads the URL without an
   Authorization header — the backend protects this endpoint with
   `JwtAuthGuard + permissions:invoices.view`, so the iframe will get a
   401 if not on a session that supports cookie auth or if the user
   navigates without a token. The current api-client uses Bearer tokens
   only. Parent should consider one of:
     - Backend: allow signed temporary URLs for HTML preview, OR
     - Frontend: fetch HTML via `apiRequest` (need to add a text variant)
       and inject into a sandboxed iframe with `srcdoc`.
   The current implementation works but only when the session cookie is
   set, OR will need follow-up for full Bearer-auth flow.

7. **Coupon DTO uses `serviceIds`** for service restriction. The form
   omits the multi-select for now (services API not wired into this
   phase). Backend will accept omission (treats as "applies to all").
   When services are available in the leaderboard, add a multi-select
   bound to `serviceIds`.

8. **Gift Card update DTO** does NOT accept `code` or `initialAmount`.
   The detail page disables those inputs and only sends `expiresAt` /
   `isActive`. `purchasedBy` / `redeemedBy` are also accepted by the DTO
   but not exposed in the form (not in the spec).

9. **Payments are owner-only at the backend** (`payments` permission
   module gated by CASL). The list/detail pages do not implement any
   create/update/refund actions — they're strictly read-only as
   instructed. Refund and bank-transfer verification flows are
   intentionally not built here.

10. **Coupon and Gift Card response wrapping** — both controllers return
    `{ success: true, data: ... }`. The api-client `apiRequest` already
    unwraps this transparently, so the api-client modules return the
    unwrapped paginated shape directly.
