'use client';

import { useState } from 'react';
import { Button } from '@deqah/ui/primitives/button';
import { Input } from '@deqah/ui/primitives/input';
import { Label } from '@deqah/ui/primitives/label';
import { Textarea } from '@deqah/ui/primitives/textarea';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@deqah/ui/primitives/sheet';
import { useGrantCredit } from './use-grant-credit';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
}

export function GrantCreditDialog({ open, onOpenChange, organizationId }: Props) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const mutation = useGrantCredit(organizationId);

  const numericAmount = Number(amount);
  const validAmount =
    Number.isFinite(numericAmount) && numericAmount >= 1 && numericAmount <= 100000;
  const validReason = reason.trim().length >= 10;
  const canSubmit = validAmount && validReason;

  const reset = () => {
    setAmount('');
    setReason('');
  };

  const submit = () => {
    if (!canSubmit) return;
    mutation.mutate(
      { organizationId, amount: numericAmount, currency: 'SAR' },
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
          <SheetTitle>Grant credit</SheetTitle>
          <SheetDescription>
            Applies a billing credit to this organization&apos;s next invoice.
            Range: 1 – 100,000{' '}
            <span className="font-mono">SAR</span>. Audited.
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="gc-amount" className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Amount <span className="font-mono text-xs">(SAR)</span>{' '}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="gc-amount"
              type="number"
              min={1}
              max={100000}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="50"
              className="tabular-nums font-mono"
            />
            {amount && !validAmount ? (
              <p className="text-xs text-destructive">
                Amount must be between 1 and 100,000 SAR.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gc-reason" className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="gc-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this credit is being granted (min 10 chars)"
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
          <Button onClick={submit} disabled={mutation.isPending || !canSubmit}>
            {mutation.isPending ? 'Granting…' : 'Grant credit'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
