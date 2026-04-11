interface Column<T> {
  key: string
  header: string
  render: (row: T) => React.ReactNode
  width?: string
}

interface Props<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  keyExtractor: (row: T) => string
  emptyMessage?: string
}

export function DataTable<T>({ columns, data, loading, keyExtractor, emptyMessage }: Props<T>) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 rounded-[var(--radius-sm)] bg-[var(--surface)] animate-pulse" />
        ))}
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="py-16 text-center text-[var(--muted)] text-sm">
        {emptyMessage ?? 'لا توجد بيانات'}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border-soft)]">
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ width: col.width }}
                className="py-3 px-4 text-start text-xs font-semibold text-[var(--muted)] uppercase tracking-wide"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={keyExtractor(row)}
              className="border-b border-[var(--border-soft)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              {columns.map((col) => (
                <td key={col.key} className="py-3 px-4 text-[var(--fg-2)]">
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
