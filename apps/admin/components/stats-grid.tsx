'use client';

export interface StatsGridStat {
  label: string;
  value: number | string;
  subLabel?: string;
  variant: 'primary' | 'success' | 'warning' | 'accent';
}

export function StatsGrid({
  stats,
  isLoading,
}: {
  stats: StatsGridStat[];
  isLoading?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border border-y border-border">
      {stats.map((s) => (
        <div key={s.label} className="p-4 flex flex-col gap-1">
          <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            {s.label}
          </div>
          <div className="text-[28px] font-medium leading-none tabular text-foreground">
            {isLoading ? (
              <span className="block h-7 w-24 rounded-sm bg-muted animate-pulse" />
            ) : (
              s.value
            )}
          </div>
          {s.subLabel && !isLoading && (
            <div className="text-[11px] text-muted-foreground">{s.subLabel}</div>
          )}
        </div>
      ))}
    </div>
  );
}
