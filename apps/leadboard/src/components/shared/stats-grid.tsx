interface StatCard {
  label: string
  value: string | number
  icon: string
  variant?: 'primary' | 'success' | 'warning' | 'accent'
}

interface Props {
  stats: StatCard[]
  loading?: boolean
}

const variantStyles: Record<NonNullable<StatCard['variant']>, string> = {
  primary: 'bg-[var(--primary-ultra)] text-[var(--primary)]',
  success: 'bg-[var(--success-bg)] text-[var(--success)]',
  warning: 'bg-[var(--warning-bg)] text-[var(--warning)]',
  accent:  'bg-[var(--accent-ultra)] text-[var(--accent-dark)]',
}

export function StatsGrid({ stats, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[100px] glass rounded-[var(--radius)] animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      {stats.map((stat, i) => (
        <div key={i} className="glass rounded-[var(--radius)] p-4 flex items-center gap-4">
          <div
            className={[
              'w-11 h-11 rounded-[var(--radius-sm)] flex items-center justify-center flex-shrink-0',
              variantStyles[stat.variant ?? 'primary'],
            ].join(' ')}
          >
            <i className={`hgi ${stat.icon} text-lg`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-[var(--muted)] truncate">{stat.label}</p>
            <p className="text-2xl font-bold text-[var(--fg)] leading-tight">{stat.value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
