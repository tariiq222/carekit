import { RatingStars } from './rating-stars'
import type { RatingStats } from '@carekit/api-client'

interface Props {
  stats: RatingStats
}

export function RatingStatsRow({ stats }: Props) {
  const max = Math.max(
    stats.distribution[1],
    stats.distribution[2],
    stats.distribution[3],
    stats.distribution[4],
    stats.distribution[5],
    1,
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="glass rounded-[var(--radius)] p-5 flex flex-col items-center justify-center text-center">
        <div className="text-4xl font-bold text-[var(--fg)]">
          {stats.average.toFixed(1)}
        </div>
        <div className="mt-2">
          <RatingStars value={Math.round(stats.average)} size="lg" />
        </div>
        <div className="mt-2 text-xs text-[var(--muted)]">
          من 5 · {stats.total} تقييم
        </div>
      </div>

      <div className="glass rounded-[var(--radius)] p-5 md:col-span-2">
        <h3 className="text-sm font-semibold text-[var(--fg)] mb-3">التوزيع</h3>
        <div className="space-y-2">
          {([5, 4, 3, 2, 1] as const).map((star) => {
            const count = stats.distribution[star]
            const pct = (count / max) * 100
            return (
              <div key={star} className="flex items-center gap-3 text-xs">
                <span className="w-6 text-[var(--muted)]">{star}★</span>
                <div className="flex-1 h-2 rounded-full bg-[var(--surface-solid)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--primary)] rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-10 text-end text-[var(--muted)]">{count}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
