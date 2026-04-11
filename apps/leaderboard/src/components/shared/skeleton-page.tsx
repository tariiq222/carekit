export function SkeletonPage() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 rounded-[var(--radius-sm)] bg-[var(--surface)] animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[100px] glass rounded-[var(--radius)] animate-pulse" />
        ))}
      </div>
      <div className="h-14 glass rounded-[var(--radius)] animate-pulse" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 rounded-[var(--radius-sm)] bg-[var(--surface)] animate-pulse" />
        ))}
      </div>
    </div>
  )
}
