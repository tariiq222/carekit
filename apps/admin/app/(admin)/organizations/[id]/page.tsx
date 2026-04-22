'use client';

import { use } from 'react';
import Link from 'next/link';
import { Badge } from '@carekit/ui/primitives/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@carekit/ui/primitives/card';
import { Skeleton } from '@carekit/ui/primitives/skeleton';
import { useGetOrganization } from '@/features/organizations/get-organization/use-get-organization';
import { SuspendDialog } from '@/features/organizations/suspend-organization/suspend-dialog';
import { ReinstateDialog } from '@/features/organizations/reinstate-organization/reinstate-dialog';
import { ImpersonateDialog } from '@/features/impersonation/start-impersonation/impersonate-dialog';

export default function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, isLoading, error } = useGetOrganization(id);

  if (isLoading || !data) return <Skeleton className="h-48" />;
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to load: {(error as Error).message}
      </div>
    );
  }

  const suspended = Boolean(data.suspendedAt);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/organizations" className="text-xs text-muted-foreground hover:underline">
            ← All organizations
          </Link>
          <h2 className="mt-1 text-2xl font-semibold">{data.nameAr}</h2>
          {data.nameEn ? <p className="text-sm text-muted-foreground">{data.nameEn}</p> : null}
          <div className="mt-2 flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{data.slug}</span>
            {suspended ? (
              <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning">
                Suspended
              </Badge>
            ) : (
              <Badge variant="outline" className="border-success/40 bg-success/10 text-success">
                Active
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {!suspended ? (
            <ImpersonateDialog organizationId={id} organizationName={data.nameAr} />
          ) : null}
          {suspended ? (
            <ReinstateDialog organizationId={id} />
          ) : (
            <SuspendDialog organizationId={id} />
          )}
        </div>
      </div>

      {suspended ? (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-4 text-sm">
            <strong>Suspended</strong> since{' '}
            {new Date(data.suspendedAt!).toLocaleString()}.{' '}
            {data.suspendedReason ? (
              <>
                Reason: <em>{data.suspendedReason}</em>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Members" value={data.stats.memberCount} />
        <StatCard label="Bookings (30d)" value={data.stats.bookingCount30d} />
        <StatCard
          label="Total revenue (SAR)"
          value={Number(data.stats.totalRevenue).toLocaleString()}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <span className="text-2xl font-semibold">{value}</span>
      </CardContent>
    </Card>
  );
}
