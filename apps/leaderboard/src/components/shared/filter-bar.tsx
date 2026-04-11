interface Props {
  search: string
  onSearchChange: (v: string) => void
  onReset: () => void
  children?: React.ReactNode
  placeholder?: string
}

export function FilterBar({ search, onSearchChange, onReset, children, placeholder }: Props) {
  return (
    <div className="glass rounded-[var(--radius)] p-3 mb-4 flex items-center gap-3 flex-wrap">
      <div className="relative flex-1 min-w-48">
        <i className="hgi hgi-search-01 absolute start-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-sm pointer-events-none" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder ?? 'بحث...'}
          className="w-full h-9 ps-9 pe-3 rounded-[var(--radius-sm)] border border-[var(--border-soft)] bg-[var(--surface-solid)] text-sm text-[var(--fg)] placeholder:text-[var(--muted-light)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
        />
      </div>
      {children}
      <button
        onClick={onReset}
        className="h-9 px-3 rounded-[var(--radius-sm)] text-xs font-medium text-[var(--muted)] hover:text-[var(--fg)] border border-[var(--border-soft)] hover:border-[var(--border-mid)] transition-colors"
      >
        إعادة تعيين
      </button>
    </div>
  )
}
