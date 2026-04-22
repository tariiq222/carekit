'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@carekit/ui/primitives/card';
import { Skeleton } from '@carekit/ui/primitives/skeleton';
import { useGetPlatformMetrics } from './use-get-platform-metrics';

export function MetricsGrid() {
  const { data, isLoading, error } = useGetPlatformMetrics();

  if (error) {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="p-4 text-sm text-destructive">
          Failed to load metrics: {(error as Error).message}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {isLoading || !data ? (
          <>
            <Skeleton className="h-[100px]" />
            <Skeleton className="h-[100px]" />
            <Skeleton className="h-[100px]" />
            <Skeleton className="h-[100px]" />
          </>
        ) : (
          <>
            <MetricCard label="Organizations" value={data.organizations.total} />
            <MetricCard label="Active" value={data.organizations.active} tone="success" />
            <MetricCard label="Suspended" value={data.organizations.suspended} tone="warning" />
            <MetricCard label="New this month" value={data.organizations.newThisMonth} />
          </>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {isLoading || !data ? (
          <>
            <Skeleton className="h-[100px]" />
            <Skeleton className="h-[100px]" />
            <Skeleton className="h-[100px]" />
          </>
        ) : (
          <>
            <MetricCard label="Users (all tenants)" value={data.users.total} />
            <MetricCard label="Bookings (30d)" value={data.bookings.totalLast30Days} />
            <MetricCard
              label="Lifetime revenue (SAR)"
              value={Number(data.revenue.lifetimePaidSar).toLocaleString()}
            />
          </>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: 'success' | 'warning';
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <span
          className={
            tone === 'success'
              ? 'text-2xl font-semibold text-success'
              : tone === 'warning'
                ? 'text-2xl font-semibold text-warning'
                : 'text-2xl font-semibold'
          }
        >
          {value}
        </span>
      </CardContent>
    </Card>
  );
}
