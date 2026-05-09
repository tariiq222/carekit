'use client';

import { useState } from 'react';
import { Button } from '@deqah/ui/primitives/button';
import { Input } from '@deqah/ui/primitives/input';
import { Label } from '@deqah/ui/primitives/label';
import { Textarea } from '@deqah/ui/primitives/textarea';
import { RadioGroup, RadioGroupItem } from '@deqah/ui/primitives/radio-group';
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
import { useRefundInvoice } from './use-refund-invoice';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: SubscriptionInvoiceRow;
  orgId: string;
}

type Mode = 'full' | 'partial';

export function RefundInvoiceDialog({ open, onOpenChange, invoice, orgId }: Props) {
  const [mode, setMode] = useState<Mode>('full');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const mutation = useRefundInvoice(orgId);

  const totalAmount = Number(invoice.amount);
  const alreadyRefunded = invoice.refundedAmount ? Number(invoice.refundedAmount) : 0;
  const remaining = totalAmount - alreadyRefunded;

  const numericPartial = Number(amount);
  const validPartial =
    Number.isFinite(numericPartial) && numericPartial >= 0.01 && numericPartial <= remaining;
  const validReason = reason.trim().length >= 10;
  const canSubmit = (mode === 'full' ? remaining > 0 : validPartial) && validReason;

  const reset = () => {
    setMode('full');
    setAmount('');
    setReason('');
  };

  const submit = () => {
    if (!canSubmit) return;
    mutation.mutate(
      { invoiceId: invoice.id, amount: mode === 'full' ? undefined : numericPartial },
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
          <SheetTitle>Refund invoice</SheetTitle>
          <SheetDescription>
            Calls Moyasar to refund{' '}
            <span className="font-mono text-xs">{invoice.id.slice(0, 8)}…</span>.
            Funds return to the organization&apos;s card.{' '}
            <span className="font-semibold">Real money movement.</span> Audited.
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="space-y-5">
          {/* Invoice summary */}
          <div className="rounded-sm border border-border bg-muted/20 px-3 py-3 text-sm">
            <div className="flex justify-between py-0.5">
              <span className="text-muted-foreground">Invoice total</span>
              <span className="tabular-nums font-mono">
                {totalAmount.toFixed(2)}{' '}
                <span className="text-xs text-muted-foreground">{invoice.currency}</span>
              </span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-muted-foreground">Already refunded</span>
              <span className="tabular-nums font-mono">
                {alreadyRefunded.toFixed(2)}{' '}
                <span className="text-xs text-muted-foreground">{invoice.currency}</span>
              </span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 mt-1.5">
              <span className="text-muted-foreground">Refundable</span>
              <span className="font-semibold tabular-nums font-mono">
                {remaining.toFixed(2)}{' '}
                <span className="text-xs font-normal text-muted-foreground">{invoice.currency}</span>
              </span>
            </div>
          </div>

          {/* Refund mode */}
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Refund amount <span className="text-destructive">*</span>
            </Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="gap-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="full" id="rf-full" />
                <Label htmlFor="rf-full" className="font-normal cursor-pointer">
                  Full{' '}
                  <span className="tabular-nums font-mono text-xs text-muted-foreground">
                    ({remaining.toFixed(2)} {invoice.currency})
                  </span>
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="partial" id="rf-partial" />
                <Label htmlFor="rf-partial" className="font-normal cursor-pointer">
                  Partial
                </Label>
              </div>
            </RadioGroup>
          </div>

          {mode === 'partial' ? (
            <div className="space-y-1.5">
              <Label htmlFor="rf-amount" className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Partial amount <span className="text-destructive">*</span>
              </Label>
              <Input
                id="rf-amount"
                type="number"
                min={0.01}
                max={remaining}
                step={0.01}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Up to ${remaining.toFixed(2)}`}
                className="tabular-nums font-mono"
              />
              {amount && !validPartial ? (
                <p className="text-xs text-destructive">
                  Amount must be between 0.01 and {remaining.toFixed(2)} {invoice.currency}.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="rf-reason" className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="rf-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this refund is being issued (min 10 chars)"
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
            {mutation.isPending ? 'Processing…' : 'Refund via Moyasar'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
