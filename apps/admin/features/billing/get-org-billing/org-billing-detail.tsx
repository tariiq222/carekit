'use client';

import { useState } from 'react';
import { Badge } from '@deqah/ui/primitives/badge';
import { Button } from '@deqah/ui/primitives/button';
import { Card, CardContent, CardHeader, CardTitle } from '@deqah/ui/primitives/card';
import { Skeleton } from '@deqah/ui/primitives/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@deqah/ui/primitives/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@deqah/ui/primitives/tabs';
import type {
  SubscriptionInvoiceRow,
  SubscriptionInvoiceStatus,
  SubscriptionStatus,
} from '../types';
import { ChangePlanDialog } from '../change-plan-for-org/change-plan-dialog';
import { GrantCreditDialog } from '../grant-credit/grant-credit-dialog';
import { RefundInvoiceDialog } from '../refund-invoice/refund-invoice-dialog';
import { WaiveInvoiceDialog } from '../waive-invoice/waive-invoice-dialog';
import { useGetOrgBilling } from './use-get-org-billing';

const WAIVABLE: SubscriptionInvoiceStatus[] = ['DUE', 'FAILED'];

function isFullyRefunded(inv: SubscriptionInvoiceRow): boolean {
  if (inv.refundedAmount === null) return false;
  return Number(inv.refundedAmount) >= Number(inv.amount);
}

const SUB_TONE: Record<SubscriptionStatus, string> = {
  ACTIVE: 'border-success/40 bg-success/10 text-success',
  TRIALING: 'border-info/40 bg-info/10 text-info',
  PAST_DUE: 'border-warning/40 bg-warning/10 text-warning',
  SUSPENDED: 'border-destructive/40 bg-destructive/10 text-destructive',
  CANCELED: 'border-destructive/40 bg-destructive/10 text-destructive',
};

const INV_TONE: Record<SubscriptionInvoiceStatus, string> = {
  PAID: 'border-success/40 bg-success/10 text-success',
  DUE: 'border-muted bg-muted text-muted-foreground',
  FAILED: 'border-warning/40 bg-warning/10 text-warning',
  VOID: 'border-destructive/40 bg-destructive/10 text-destructive',
  DRAFT: 'border-muted bg-muted text-muted-foreground',
};

function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

interface Props {
  orgId: string;
}

export function OrgBillingDetail({ orgId }: Props) {
  const { data, isLoading, error } = useGetOrgBilling(orgId);
  const [waiveTarget, setWaiveTarget] = useState<SubscriptionInvoiceRow | null>(null);
  const [refundTarget, setRefundTarget] = useState<SubscriptionInvoiceRow | null>(null);
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [grantCreditOpen, setGrantCreditOpen] = useState(false);

  if (error) {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="p-4 text-sm text-destructive">
          Failed to load: {(error as Error).message}
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !data) return <Skeleton className="h-[400px]" />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {data.org.nameAr}
            {data.org.nameEn ? (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                · {data.org.nameEn}
              </span>
            ) : null}
          </CardTitle>
          <p className="text-xs text-muted-foreground font-mono">
            {data.org.slug} · {data.org.id}
          </p>
        </CardHeader>
      </Card>

      <Tabs defaultValue="subscription">
        <TabsList>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="invoices">Invoices ({data.invoices.length})</TabsTrigger>
          <TabsTrigger value="usage">Usage ({data.usage.length})</TabsTrigger>
          <TabsTrigger value="credits">Credits ({data.credits.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="subscription" className="mt-4">
          {data.subscription ? (
            <Card>
              <CardContent className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
                <Field label="Plan">
                  {data.subscription.plan.nameEn}{' '}
                  <span className="text-muted-foreground">
                    ({Number(data.subscription.plan.priceMonthly).toFixed(2)} SAR/mo)
                  </span>
                </Field>
                <Field label="Status">
                  <Badge variant="outline" className={SUB_TONE[data.subscription.status]}>
                    {data.subscription.status.replace('_', ' ')}
                  </Badge>
                </Field>
                <Field label="Cycle">{data.subscription.billingCycle}</Field>
                <Field label="Period">
                  {fmt(data.subscription.currentPeriodStart)} →{' '}
                  {fmt(data.subscription.currentPeriodEnd)}
                </Field>
                <Field label="Trial ends">{fmt(data.subscription.trialEndsAt)}</Field>
                <Field label="Last payment">{fmt(data.subscription.lastPaymentAt)}</Field>
                {data.subscription.pastDueSince ? (
                  <Field label="Past due since">{fmt(data.subscription.pastDueSince)}</Field>
                ) : null}
                {data.subscription.lastFailureReason ? (
                  <Field label="Last failure">{data.subscription.lastFailureReason}</Field>
                ) : null}
              </CardContent>
              <CardContent className="border-t border-border pt-4">
                <Button variant="outline" size="sm" onClick={() => setChangePlanOpen(true)}>
                  Change plan…
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                No subscription on file for this organization.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Refunded</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      No invoices.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs">{inv.id.slice(0, 8)}…</TableCell>
                      <TableCell className="font-medium">
                        {Number(inv.amount).toFixed(2)} {inv.currency}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {inv.refundedAmount ? `−${Number(inv.refundedAmount).toFixed(2)}` : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={INV_TONE[inv.status]}>
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {fmt(inv.periodStart)} → {fmt(inv.periodEnd)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {fmt(inv.dueDate)}
                      </TableCell>
                      <TableCell className="text-right">
                        {WAIVABLE.includes(inv.status) ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setWaiveTarget(inv)}
                          >
                            Waive
                          </Button>
                        ) : inv.status === 'PAID' && !isFullyRefunded(inv) ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRefundTarget(inv)}
                          >
                            Refund
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="mt-4">
          <Card>
            <CardContent className="p-6">
              {data.usage.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No usage records for the current billing period.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.usage.map((u) => (
                    <li
                      key={`${u.metric}-${u.periodStart}`}
                      className="flex items-center justify-between border-b border-border pb-2 last:border-0"
                    >
                      <span className="font-medium">{u.metric.replace(/_/g, ' ')}</span>
                      <span className="font-mono">{u.count.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credits" className="mt-4">
          <Card>
            <CardContent className="flex justify-end border-b border-border py-3">
              <Button variant="outline" size="sm" onClick={() => setGrantCreditOpen(true)}>
                Grant credit…
              </Button>
            </CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Amount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Granted</TableHead>
                  <TableHead>Consumed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.credits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      No credits granted to this organization.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.credits.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        {Number(c.amount).toFixed(2)} {c.currency}
                      </TableCell>
                      <TableCell className="text-sm">{c.reason}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {fmt(c.grantedAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.consumedAt ? fmt(c.consumedAt) : 'unused'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {waiveTarget ? (
        <WaiveInvoiceDialog
          open={Boolean(waiveTarget)}
          onOpenChange={(o) => !o && setWaiveTarget(null)}
          invoice={waiveTarget}
          orgId={orgId}
        />
      ) : null}

      {refundTarget ? (
        <RefundInvoiceDialog
          open={Boolean(refundTarget)}
          onOpenChange={(o) => !o && setRefundTarget(null)}
          invoice={refundTarget}
          orgId={orgId}
        />
      ) : null}

      <GrantCreditDialog
        open={grantCreditOpen}
        onOpenChange={setGrantCreditOpen}
        organizationId={orgId}
      />

      {data.subscription ? (
        <ChangePlanDialog
          open={changePlanOpen}
          onOpenChange={setChangePlanOpen}
          organizationId={orgId}
          currentPlanId={data.subscription.planId}
          currentPlanLabel={`${data.subscription.plan.nameEn} (${data.subscription.plan.slug}) · ${Number(data.subscription.plan.priceMonthly).toFixed(2)} SAR/mo`}
        />
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}
