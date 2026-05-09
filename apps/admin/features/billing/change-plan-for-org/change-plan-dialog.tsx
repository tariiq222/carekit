'use client';

import { useState } from 'react';
import { Button } from '@deqah/ui/primitives/button';
import { Label } from '@deqah/ui/primitives/label';
import { Textarea } from '@deqah/ui/primitives/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@deqah/ui/primitives/select';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@deqah/ui/primitives/sheet';
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
      { organizationId, newPlanId },
      {
        onSuccess: () => {
          onOpenChange(false);
          reset();
        },
      },
    );
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Change plan</SheetTitle>
          <SheetDescription>
            Switch this organization to a different plan. Change is{' '}
            <span className="font-semibold">immediate, no proration</span> — next invoice
            reflects the new plan price. Audited.
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Current plan
            </Label>
            <div className="rounded-sm border border-border bg-muted/30 px-3 py-2 font-mono text-xs">
              {currentPlanLabel}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cp-newplan" className="text-[11px] uppercase tracking-widest text-muted-foreground">
              New plan <span className="text-destructive">*</span>
            </Label>
            <Select value={newPlanId} onValueChange={setNewPlanId}>
              <SelectTrigger id="cp-newplan">
                <SelectValue placeholder={loadingPlans ? 'Loading…' : 'Select a plan'} />
              </SelectTrigger>
              <SelectContent>
                {(plans ?? [])
                  .filter((p) => p.isActive && p.id !== currentPlanId)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="font-mono text-xs uppercase">{p.slug}</span>
                      {' — '}
                      {p.nameEn}{' '}
                      <span className="tabular-nums text-muted-foreground">
                        · {Number(p.priceMonthly).toFixed(2)} SAR/mo
                      </span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cp-reason" className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="cp-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this plan change is being made (min 10 chars)"
              rows={4}
            />
            {reason.length > 0 && !validReason ? (
              <p className="text-xs text-destructive">
                Reason must be at least 10 characters ({reason.length}/10).
              </p>
            ) : null}
          </div>
        </SheetBody>

        <SheetFooter>
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
              reset();
            }}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            className="border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
            onClick={submit}
            disabled={mutation.isPending || !canSubmit}
          >
            {mutation.isPending ? 'Changing…' : 'Change plan'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
