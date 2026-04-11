# Phase 5 — Wiring TODO for parent

## packages/api-client/src/index.ts — add these exports

```ts
export * as availabilityApi from './modules/availability.js'
export * as ratingsApi from './modules/ratings.js'
```

## packages/api-client/src/types/index.ts — add these type re-exports

```ts
export type {
  PractitionerAvailability,
  AvailabilitySlotInput,
  SetAvailabilityPayload,
  GetAvailabilityResponse,
  SetAvailabilityResponse,
} from './availability.js'

export type {
  PractitionerRating,
  RatingDistribution,
  RatingStats,
  RatingListQuery,
  RatingListResponse,
} from './rating.js'
```

## apps/leaderboard/src/lib/query-keys.ts — add these keys

Inside the `QUERY_KEYS` object literal add:

```ts
practitionerAvailability: {
  all: ['practitioner-availability'] as const,
  detail: (practitionerId: string) =>
    ['practitioner-availability', practitionerId] as const,
},
practitionerRatings: {
  all: ['practitioner-ratings'] as const,
  list: (practitionerId: string, params: Record<string, unknown>) =>
    ['practitioner-ratings', practitionerId, params] as const,
},
```

After wiring, update:

- `apps/leaderboard/src/hooks/use-availability.ts` — replace inline
  `availabilityKey` with `QUERY_KEYS.practitionerAvailability.detail(id)`
  and replace the deep relative imports with:
  ```ts
  import { availabilityApi } from '@carekit/api-client'
  import type { SetAvailabilityPayload } from '@carekit/api-client'
  ```
- `apps/leaderboard/src/hooks/use-ratings.ts` — same treatment with
  `QUERY_KEYS.practitionerRatings.list(id, query)` and:
  ```ts
  import { ratingsApi } from '@carekit/api-client'
  import type { RatingListQuery } from '@carekit/api-client'
  ```
- `apps/leaderboard/src/routes/_dashboard/practitioners/$id.availability.tsx`
  — replace deep relative type import with `@carekit/api-client`.
- `apps/leaderboard/src/routes/_dashboard/practitioners/$id.ratings.tsx`
  — same.
- `apps/leaderboard/src/components/features/practitioners/rating-stats-row.tsx`
  — same.

The deep relative imports were a workaround because this subagent
could not edit `packages/api-client/src/index.ts` per ownership rules.

## Practitioner detail page ($id.tsx) — optional tabs/links TODO

Suggestion for parent: add a tabs section or action buttons on the
existing `apps/leaderboard/src/routes/_dashboard/practitioners/$id.tsx`
page linking to the new pages, e.g. inside the PageHeader `actions` slot:

```tsx
<Link to="/practitioners/$id/availability" params={{ id }}>
  <Button variant="outline">
    <i className="hgi hgi-calendar-03 me-1" />
    جدول التوفر
  </Button>
</Link>
<Link to="/practitioners/$id/ratings" params={{ id }}>
  <Button variant="outline">
    <i className="hgi hgi-star me-1" />
    التقييمات
  </Button>
</Link>
```

(Do NOT have this subagent edit `$id.tsx` — out of scope.)

## Backend endpoint notes

- `GET /practitioners/:id/availability` returns `{ schedule: PractitionerAvailability[] }`
  (controller wraps the array in `{ schedule }`). The api-client
  `availabilityApi.get` unwraps it and returns the array directly.
- `PUT /practitioners/:id/availability` returns
  `{ success, data: { schedule }, message }` (envelope). The api-client
  `availabilityApi.update` unwraps to the array.
- `GET /practitioners/:id/ratings` returns `{ items, meta }` directly
  (no envelope). Pagination accepts `page` and `perPage` only — the
  backend does NOT currently support `minStars`, `fromDate`, or
  `toDate` filters. The leaderboard ratings page sends those params
  (they will be ignored by the backend) and additionally filters
  client-side on `minStars` for the visible items. If true server-side
  filtering is required, the backend `PractitionerRatingsService.getRatings`
  needs extending to accept those query params.
- The backend does NOT expose a stats endpoint for practitioner
  ratings (average / distribution). The leaderboard computes stats
  client-side from the current page of items, and uses `meta.total`
  for the total count. This is approximate (only the visible page is
  reflected in distribution/average). For accurate stats, a backend
  endpoint such as `GET /practitioners/:id/ratings/stats` returning
  `{ average, total, distribution }` should be added.
