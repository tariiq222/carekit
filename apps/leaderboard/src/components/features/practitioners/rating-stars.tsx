interface Props {
  value: number
  size?: 'sm' | 'md' | 'lg'
}

export function RatingStars({ value, size = 'md' }: Props) {
  const sizeClass =
    size === 'lg' ? 'text-xl' : size === 'sm' ? 'text-xs' : 'text-base'
  return (
    <div className={`inline-flex items-center gap-0.5 ${sizeClass}`} aria-label={`${value} من 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <i
          key={n}
          className={
            n <= value
              ? 'hgi-stroke hgi-star-solid text-[var(--warning,#f59e0b)]'
              : 'hgi-stroke hgi-star text-[var(--muted)]'
          }
        />
      ))}
    </div>
  )
}
