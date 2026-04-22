'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Badge } from '@carekit/ui/primitives/badge';
import { Button } from '@carekit/ui/primitives/button';
import { Card, CardContent, CardHeader, CardTitle } from '@carekit/ui/primitives/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@carekit/ui/primitives/dialog';
import { Label } from '@carekit/ui/primitives/label';
import { Skeleton } from '@carekit/ui/primitives/skeleton';
import { Textarea } from '@carekit/ui/primitives/textarea';
import { adminApi } from '@/lib/api';

export default function OrganizationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['organization', id],
    queryFn: () => adminApi.getOrganization(id),
  });

  const [suspendReason, setSuspendReason] = useState('');
  const [reinstateReason, setReinstateReason] = useState('');
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [reinstateOpen, setReinstateOpen] = useState(false);

  const suspendMut = useMutation({
    mutationFn: () => adminApi.suspendOrganization(id, suspendReason),
    onSuccess: () => {
      toast.success('Organization suspended.');
      setSuspendOpen(false);
      setSuspendReason('');
      void qc.invalidateQueries({ queryKey: ['organization', id] });
      void qc.invalidateQueries({ queryKey: ['organizations'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Suspend failed'),
  });

  const reinstateMut = useMutation({
    mutationFn: () =>
      adminApi.reinstateOrganization(id, reinstateReason || 'Reinstated by super-admin'),
    onSuccess: () => {
      toast.success('Organization reinstated.');
      setReinstateOpen(false);
      setReinstateReason('');
      void qc.invalidateQueries({ queryKey: ['organization', id] });
      void qc.invalidateQueries({ queryKey: ['organizations'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Reinstate failed'),
  });

  if (isLoading || !data) {
    return <Skeleton className="h-48" />;
  }
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
          {data.nameEn ? (
            <p className="text-sm text-muted-foreground">{data.nameEn}</p>
          ) : null}
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
          {suspended ? (
            <Dialog open={reinstateOpen} onOpenChange={setReinstateOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Reinstate</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reinstate organization</DialogTitle>
                  <DialogDescription>
                    Reason for reinstatement (optional, written to audit log).
                  </DialogDescription>
                </DialogHeader>
                <Textarea
                  value={reinstateReason}
                  onChange={(e) => setReinstateReason(e.target.value)}
                  rows={3}
                />
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setReinstateOpen(false)}
                    disabled={reinstateMut.isPending}
                  >
                    Cancel
                  </Button>
                  <Button onClick={() => reinstateMut.mutate()} disabled={reinstateMut.isPending}>
                    {reinstateMut.isPending ? 'Reinstating…' : 'Confirm reinstate'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive">Suspend</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Suspend organization</DialogTitle>
                  <DialogDescription>
                    Members will be signed out within 30 seconds. Reason is required (min 10
                    characters) and written to the audit log.
                  </DialogDescription>
                </DialogHeader>
                <Label htmlFor="suspend-reason">Reason</Label>
                <Textarea
                  id="suspend-reason"
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  rows={3}
                  placeholder="e.g., Non-payment past 60-day grace period"
                />
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setSuspendOpen(false)}
                    disabled={suspendMut.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => suspendMut.mutate()}
                    disabled={suspendMut.isPending || suspendReason.trim().length < 10}
                  >
                    {suspendMut.isPending ? 'Suspending…' : 'Confirm suspend'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
