import { RatingStars } from './rating-stars'

interface RatingCardProps {
  stars: number
  comment: string | null
  patientName: string
  createdAt: string
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

export function RatingCard({ stars, comment, patientName, createdAt }: RatingCardProps) {
  return (
    <article className="glass rounded-[var(--radius)] p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <RatingStars value={stars} />
        <span className="text-xs text-[var(--muted)]">{formatDate(createdAt)}</span>
      </div>
      {comment && (
        <p className="text-sm text-[var(--fg)] leading-relaxed whitespace-pre-line">
          {comment}
        </p>
      )}
      <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-soft)]">
        <span className="inline-flex items-center justify-center size-7 rounded-full bg-[var(--surface-solid)] text-[var(--muted)]">
          <i className="hgi hgi-user" />
        </span>
        <span className="text-xs text-[var(--muted)]">{patientName}</span>
      </div>
    </article>
  )
}
