import { useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { PageHeader } from '@/components/shared/page-header'
import { SkeletonPage } from '@/components/shared/skeleton-page'
import { Button } from '@/components/ui/button'
import { usePractitioner } from '@/hooks/use-practitioners'
import { usePractitionerRatings } from '@/hooks/use-ratings'
import { RatingCard } from '@/components/features/practitioners/rating-card'
import { RatingStatsRow } from '@/components/features/practitioners/rating-stats-row'
import type {
  RatingListQuery,
  RatingStats,
  PractitionerRating,
} from '../../../../../../packages/api-client/src/types/rating.js'

export const Route = createFileRoute('/_dashboard/practitioners/$id/ratings')({
  component: PractitionerRatingsPage,
})

const STAR_OPTIONS: Array<{ value: '' | number; label: string }> = [
  { value: '', label: 'كل التقييمات' },
  { value: 5, label: '5 نجوم فقط' },
  { value: 4, label: '4+ نجوم' },
  { value: 3, label: '3+ نجوم' },
  { value: 2, label: '2+ نجوم' },
  { value: 1, label: '1+ نجمة' },
]

function computeStats(ratings: PractitionerRating[], total: number): RatingStats {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let sum = 0
  for (const r of ratings) {
    sum += r.stars
    const key = r.stars as 1 | 2 | 3 | 4 | 5
    if (key >= 1 && key <= 5) distribution[key] += 1
  }
  return {
    average: ratings.length > 0 ? sum / ratings.length : 0,
    total,
    distribution,
  }
}

function PractitionerRatingsPage() {
  const { id } = Route.useParams()
  const [query, setQuery] = useState<RatingListQuery>({ page: 1, perPage: 12 })

  const { data: practitioner, isLoading: pLoading } = usePractitioner(id)
  const { data, isLoading } = usePractitionerRatings(id, query)

  const items = data?.items ?? []
  const meta = data?.meta

  const filtered = useMemo(() => {
    if (!query.minStars) return items
    return items.filter((r) => r.stars >= (query.minStars ?? 0))
  }, [items, query.minStars])

  const stats = useMemo(
    () => computeStats(filtered, meta?.total ?? 0),
    [filtered, meta?.total],
  )

  if (pLoading || (isLoading && !data)) return <SkeletonPage />
  if (!practitioner) {
    return <p className="text-[var(--muted)] p-6">الممارس غير موجود</p>
  }

  const fullName = `${practitioner.user.firstName} ${practitioner.user.lastName}`

  return (
    <div className="space-y-6">
      <PageHeader
        title="التقييمات"
        description={`${fullName} · ${meta?.total ?? 0} تقييم`}
        actions={
          <Link to="/practitioners/$id" params={{ id }}>
            <Button variant="outline">رجوع</Button>
          </Link>
        }
      />

      <RatingStatsRow stats={stats} />

      <div className="glass rounded-[var(--radius)] p-3 flex flex-wrap items-center gap-3">
        <span className="text-xs text-[var(--muted)] ms-1">تصفية:</span>
        <select
          value={query.minStars ?? ''}
          onChange={(e) =>
            setQuery((q) => ({
              ...q,
              page: 1,
              minStars: e.target.value ? Number(e.target.value) : undefined,
            }))
          }
          className="h-9 rounded-[var(--radius-sm)] border border-[var(--border-soft)] bg-[var(--surface-solid)] text-sm text-[var(--fg)] px-3"
        >
          {STAR_OPTIONS.map((opt) => (
            <option key={String(opt.value)} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={query.fromDate ?? ''}
          onChange={(e) =>
            setQuery((q) => ({ ...q, page: 1, fromDate: e.target.value || undefined }))
          }
          className="h-9 rounded-[var(--radius-sm)] border border-[var(--border-soft)] bg-[var(--surface-solid)] text-sm text-[var(--fg)] px-3"
          aria-label="من تاريخ"
        />
        <input
          type="date"
          value={query.toDate ?? ''}
          onChange={(e) =>
            setQuery((q) => ({ ...q, page: 1, toDate: e.target.value || undefined }))
          }
          className="h-9 rounded-[var(--radius-sm)] border border-[var(--border-soft)] bg-[var(--surface-solid)] text-sm text-[var(--fg)] px-3"
          aria-label="إلى تاريخ"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setQuery({ page: 1, perPage: 12 })}
          className="ms-auto"
        >
          إعادة تعيين
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="glass rounded-[var(--radius)] p-10 text-center text-sm text-[var(--muted)]">
          لا توجد تقييمات
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((r) => {
            const patientName = r.patient
              ? `${r.patient.firstName} ${r.patient.lastName}`
              : 'مريض'
            return (
              <RatingCard
                key={r.id}
                stars={r.stars}
                comment={r.comment}
                patientName={patientName}
                createdAt={r.createdAt}
              />
            )
          })}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="glass rounded-[var(--radius)] p-3 flex items-center justify-between">
          <span className="text-xs text-[var(--muted)]">
            صفحة {meta.page} من {meta.totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.hasPreviousPage}
              onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) - 1 }))}
            >
              السابق
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.hasNextPage}
              onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) + 1 }))}
            >
              التالي
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
