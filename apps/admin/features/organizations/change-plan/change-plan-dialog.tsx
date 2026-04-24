'use client';

import { useState } from 'react';
import { Button } from '@carekit/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@carekit/ui/primitives/dialog';
import { Label } from '@carekit/ui/primitives/label';
import { Textarea } from '@carekit/ui/primitives/textarea';
import { useListPlans } from '@/features/plans/list-plans/use-list-plans';
import { useChangePlan } from './use-change-plan';

interface Props {
  orgId: string;
  currentPlanId: string;
}

export function ChangePlanDialog({ orgId, currentPlanId }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [reason, setReason] = useState('');

  const { data: plans = [] } = useListPlans();
  const mutation = useChangePlan(orgId);

  const activePlans = plans.filter((p) => p.isActive);
  const isValid = selectedPlanId !== '' && selectedPlanId !== currentPlanId && reason.trim().length >= 10;

  function handleOpen(val: boolean) {
    setOpen(val);
    if (!val) {
      setSelectedPlanId('');
      setReason('');
    }
  }

  function submit() {
    if (!isValid) return;
    mutation.mutate(
      { newPlanId: selectedPlanId, reason: reason.trim() },
      {
        onSuccess: () => {
          setOpen(false);
          setSelectedPlanId('');
          setReason('');
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Change Plan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change subscription plan</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="cp-plan">New plan</Label>
            <select
              id="cp-plan"
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— select a plan —</option>
              {activePlans.map((p) => (
                <option key={p.id} value={p.id} disabled={p.id === currentPlanId}>
                  {p.slug} — {p.nameEn}{p.id === currentPlanId ? ' (current)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cp-reason">Reason (min 10 chars)</Label>
            <Textarea
              id="cp-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for changing plan (written to audit log)…"
            />
          </div>

          {mutation.error ? (
            <p className="text-xs text-destructive">
              {(mutation.error as Error).message}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!isValid || mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Confirm change'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
