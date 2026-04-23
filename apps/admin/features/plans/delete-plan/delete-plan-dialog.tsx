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
import { Textarea } from '@carekit/ui/primitives/textarea';
import type { PlanRow } from '../types';
import { useDeletePlan } from './use-delete-plan';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: PlanRow;
}

export function DeletePlanDialog({ open, onOpenChange, plan }: Props) {
  const [reason, setReason] = useState('');
  const mutation = useDeletePlan();

  const isValid = reason.trim().length >= 10;

  const submit = () => {
    if (!isValid) return;
    mutation.mutate(
      { planId: plan.id, reason: reason.trim() },
      {
        onSuccess: () => {
          onOpenChange(false);
          setReason('');
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete plan</DialogTitle>
          <DialogDescription>
            You are about to delete{' '}
            <span className="font-semibold">
              {plan.nameEn} ({plan.slug})
            </span>
            . This action cannot be undone. Reason is required and written to the audit log.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="dp-reason">Reason (min 10 chars)</Label>
          <Textarea
            id="dp-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for deleting this plan…"
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setReason('');
            }}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={mutation.isPending || !isValid}
          >
            {mutation.isPending ? 'Deleting…' : 'Delete plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
