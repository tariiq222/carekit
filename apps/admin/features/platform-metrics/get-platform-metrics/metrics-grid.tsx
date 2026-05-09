'use client';

import { useGetPlatformMetrics } from './use-get-platform-metrics';
import { formatSar } from '@/lib/currency';

interface KpiCellProps {
  label: string;
  value: string | number;
  tone?: 'success' | 'warning';
}

function KpiCell({ label, value, tone }: KpiCellProps) {
  const numClass = [
    'mt-2 text-[28px] font-semibold leading-none tabular',
    tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="px-5 py-4 first:ps-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </p>
      <p className={numClass}>{value}</p>
    </div>
  );
}

export function MetricsGrid() {
  const { data, isLoading, error } = useGetPlatformMetrics();

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load metrics: {(error as Error).message}
      </p>
    );
  }

  if (isLoading || !data) {
    return <div className="animate-pulse h-16 rounded-md bg-muted" />;
  }

  return (
    <div className="flex divide-x divide-border overflow-hidden rounded-md border border-border">
      <KpiCell label="Orgs" value={data.organizations.total} />
      <KpiCell label="Active" value={data.organizations.active} tone="success" />
      <KpiCell label="Suspended" value={data.organizations.suspended} tone="warning" />
      <KpiCell label="New this month" value={data.organizations.newThisMonth} />
      <KpiCell label="Users" value={data.users.total} />
      <KpiCell label="Bookings 30d" value={data.bookings.totalLast30Days} />
      <KpiCell label="Lifetime revenue" value={formatSar(data.revenue.lifetimePaidSar)} />
    </div>
  );
}
