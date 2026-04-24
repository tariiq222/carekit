'use client';

import { use } from 'react';
import Link from 'next/link';
import { Badge } from '@carekit/ui/primitives/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@carekit/ui/primitives/card';
import { Skeleton } from '@carekit/ui/primitives/skeleton';
import { useGetOrganization } from '@/features/organizations/get-organization/use-get-organization';
import { useGetOrgBilling } from '@/features/organizations/get-org-billing/use-get-org-billing';
import { SuspendDialog } from '@/features/organizations/suspend-organization/suspend-dialog';
import { ReinstateDialog } from '@/features/organizations/reinstate-organization/reinstate-dialog';
import { ImpersonateDialog } from '@/features/impersonation/start-impersonation/impersonate-dialog';
import { ChangePlanDialog } from '@/features/organizations/change-plan/change-plan-dialog';

export default function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, isLoading, error } = useGetOrganization(id);
  const { data: billing } = useGetOrgBilling(id);

  if (isLoading || !data) return <Skeleton className="h-48" />;
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to load: {(error as Error).message}
      </div>
    );
  }

  const suspended = Boolean(data.suspendedAt);
  const sub = billing?.subscription ?? null;

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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Subscription</CardTitle>
          {sub ? (
            <ChangePlanDialog orgId={id} currentPlanId={sub.planId} />
          ) : null}
        </CardHeader>
        <CardContent>
          {!sub ? (
            <p className="text-sm text-muted-foreground">No subscription found.</p>
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Plan</dt>
                <dd className="mt-0.5 font-medium">
                  {sub.plan.slug}
                  <span className="ml-1 text-xs text-muted-foreground">({sub.plan.nameEn})</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Status</dt>
                <dd className="mt-0.5">
                  <SubStatusBadge status={sub.status} />
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Cycle</dt>
                <dd className="mt-0.5">{sub.billingCycle}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Period start</dt>
                <dd className="mt-0.5">{new Date(sub.currentPeriodStart).toLocaleDateString()}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Period end</dt>
                <dd className="mt-0.5">{new Date(sub.currentPeriodEnd).toLocaleDateString()}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Monthly price</dt>
                <dd className="mt-0.5">{Number(sub.plan.priceMonthly).toLocaleString()} SAR</dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>
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

function SubStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: 'border-success/40 bg-success/10 text-success',
    TRIALING: 'border-primary/40 bg-primary/10 text-primary',
    PAST_DUE: 'border-warning/40 bg-warning/10 text-warning',
    SUSPENDED: 'border-destructive/40 bg-destructive/10 text-destructive',
    CANCELED: 'border-muted/40 bg-muted/10 text-muted-foreground',
  };
  return (
    <Badge variant="outline" className={map[status] ?? 'border-border bg-muted/10'}>
      {status}
    </Badge>
  );
}
