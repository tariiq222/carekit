'use client';

import { useState } from 'react';
import { Button } from '@carekit/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@carekit/ui/primitives/dialog';
import { Label } from '@carekit/ui/primitives/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@carekit/ui/primitives/select';
import { Textarea } from '@carekit/ui/primitives/textarea';
import { useChangePlanForOrg, usePlanOptions } from './use-change-plan-for-org';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  currentPlanId: string;
  currentPlanLabel: string;
}

export function ChangePlanDialog({
  open,
  onOpenChange,
  organizationId,
  currentPlanId,
  currentPlanLabel,
}: Props) {
  const [newPlanId, setNewPlanId] = useState('');
  const [reason, setReason] = useState('');
  const { data: plans, isLoading: loadingPlans } = usePlanOptions();
  const mutation = useChangePlanForOrg(organizationId);

  const validPlan = newPlanId && newPlanId !== currentPlanId;
  const validReason = reason.trim().length >= 10;
  const canSubmit = validPlan && validReason;

  const reset = () => {
    setNewPlanId('');
    setReason('');
  };

  const submit = () => {
    if (!canSubmit) return;
    mutation.mutate(
      { organizationId, newPlanId, reason: reason.trim() },
      {
        onSuccess: () => {
          onOpenChange(false);
          reset();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change plan</DialogTitle>
          <DialogDescription>
            Switch this organization to a different plan. Change is{' '}
            <span className="font-semibold">immediate, with no proration</span> — the next
            invoice will reflect the new plan’s price. Audited.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Current plan</Label>
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              {currentPlanLabel}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-newplan">New plan</Label>
            <Select value={newPlanId} onValueChange={setNewPlanId}>
              <SelectTrigger id="cp-newplan">
                <SelectValue placeholder={loadingPlans ? 'Loading…' : 'Pick a plan'} />
              </SelectTrigger>
              <SelectContent>
                {(plans ?? [])
                  .filter((p) => p.isActive && p.id !== currentPlanId)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nameEn} ({p.slug}) · {Number(p.priceMonthly).toFixed(2)} SAR/mo
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-reason">Reason (min 10 chars)</Label>
            <Textarea
              id="cp-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for changing the plan…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              reset();
            }}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={mutation.isPending || !canSubmit}>
            {mutation.isPending ? 'Changing…' : 'Change plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
