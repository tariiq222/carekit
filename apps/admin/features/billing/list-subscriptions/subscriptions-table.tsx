'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@deqah/ui/primitives/badge';
import { Button } from '@deqah/ui/primitives/button';
import { Skeleton } from '@deqah/ui/primitives/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@deqah/ui/primitives/table';
import { formatAdminDate } from '@/lib/date';
import type { OrganizationBillingIdentity, SubscriptionRow, SubscriptionStatus } from '../types';

const STATUS_DOT: Record<SubscriptionStatus, string> = {
  ACTIVE: 'bg-success',
  TRIALING: 'bg-info',
  PAST_DUE: 'bg-warning',
  SUSPENDED: 'bg-destructive',
  CANCELED: 'bg-muted-foreground',
};

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  ACTIVE: 'border-success/40 bg-success/10 text-success',
  TRIALING: 'border-info/40 bg-info/10 text-info',
  PAST_DUE: 'border-warning/40 bg-warning/10 text-warning',
  SUSPENDED: 'border-destructive/40 bg-destructive/10 text-destructive',
  CANCELED: 'border-destructive/40 bg-destructive/10 text-destructive',
};

const ORG_STATUS_TONE: Record<string, string> = {
  ACTIVE: 'border-success/40 bg-success/10 text-success',
  TRIALING: 'border-primary/40 bg-primary/10 text-primary',
  PAST_DUE: 'border-warning/40 bg-warning/10 text-warning',
  SUSPENDED: 'border-warning/40 bg-warning/10 text-warning',
  ARCHIVED: 'border-muted/40 bg-muted/10 text-muted-foreground',
};

interface Props {
  items: SubscriptionRow[] | undefined;
  isLoading: boolean;
}

export function SubscriptionsTable({ items, isLoading }: Props) {
  const locale = useLocale();
  const t = useTranslations('billing.tables');
  const statusT = useTranslations('billing.subscriptionStatus');
  const orgStatusT = useTranslations('organizations.status');

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('organization')}</TableHead>
          <TableHead>{t('plan')}</TableHead>
          <TableHead>{t('status')}</TableHead>
          <TableHead>{t('cycle')}</TableHead>
          <TableHead>{t('periodEnds')}</TableHead>
          <TableHead className="text-right tabular-nums">MRR</TableHead>
          <TableHead>{t('lastPayment')}</TableHead>
          <TableHead className="text-end">{t('actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading && !items
          ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`skeleton-row-${i}`}>
                <TableCell colSpan={8}>
                  <Skeleton className="h-5" />
                </TableCell>
              </TableRow>
            ))
          : items?.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <OrgCell
                    organization={s.organization}
                    fallbackId={s.organizationId}
                    statusLabel={s.organization ? orgStatusT(s.organization.status) : undefined}
                  />
                </TableCell>
                <TableCell>
                  <span className="font-mono text-xs uppercase tracking-wide">
                    {s.plan.slug ?? s.plan.nameEn}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={[
                        'inline-block size-1.5 rounded-full shrink-0',
                        STATUS_DOT[s.status],
                      ].join(' ')}
                    />
                    <Badge variant="outline" className={STATUS_LABEL[s.status]}>
                      {statusT(s.status)}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{s.billingCycle}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {formatAdminDate(s.currentPeriodEnd, locale)}
                </TableCell>
                <TableCell className="text-right">
                  <span className="tabular-nums font-mono text-sm">
                    {Number(s.plan.priceMonthly).toFixed(2)}
                  </span>
                  <span className="ml-1 text-xs text-muted-foreground">SAR</span>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {formatAdminDate(s.lastPaymentAt, locale)}
                </TableCell>
                <TableCell className="text-end">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/billing/${s.organizationId}`}>{t('open')}</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
        {!isLoading && items?.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
              {t('emptySubscriptions')}
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}

function OrgCell({
  organization,
  fallbackId,
  statusLabel,
}: {
  organization?: OrganizationBillingIdentity;
  fallbackId: string;
  statusLabel?: string;
}) {
  if (!organization) {
    return (
      <span className="font-mono text-xs text-muted-foreground">{fallbackId.slice(0, 8)}…</span>
    );
  }

  return (
    <div className="space-y-0.5">
      <div className="font-medium text-sm">{organization.nameAr}</div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        {organization.nameEn ? <span>{organization.nameEn}</span> : null}
        <span className="font-mono">{organization.slug}</span>
        <Badge
          variant="outline"
          className={ORG_STATUS_TONE[organization.status] ?? 'border-border bg-muted/10'}
        >
          {statusLabel ?? organization.status}
        </Badge>
      </div>
    </div>
  );
}
