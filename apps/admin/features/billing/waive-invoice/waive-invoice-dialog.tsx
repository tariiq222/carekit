'use client';

import { useState } from 'react';
import { Button } from '@deqah/ui/primitives/button';
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
import type { SubscriptionInvoiceRow } from '../types';
import { useWaiveInvoice } from './use-waive-invoice';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: SubscriptionInvoiceRow;
  orgId: string;
}

export function WaiveInvoiceDialog({ open, onOpenChange, invoice, orgId }: Props) {
  const [reason, setReason] = useState('');
  const mutation = useWaiveInvoice(orgId);

  const canSubmit = reason.trim().length >= 10;

  const reset = () => setReason('');

  const submit = () => {
    if (!canSubmit) return;
    mutation.mutate(
      { invoiceId: invoice.id },
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
          <SheetTitle>Waive invoice</SheetTitle>
          <SheetDescription>
            Voids invoice{' '}
            <span className="font-mono text-xs">{invoice.id.slice(0, 8)}…</span> for{' '}
            <span className="tabular-nums font-mono">
              {Number(invoice.amount).toFixed(2)} {invoice.currency}
            </span>
            . No money moves. DUE/FAILED only. PAID invoices require a refund. Audited.
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="waive-reason" className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="waive-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this invoice is being waived (min 10 chars)"
              rows={4}
            />
            {reason.length > 0 && !canSubmit ? (
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
            {mutation.isPending ? 'Waiving…' : 'Waive invoice'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
