'use client';

import { useState } from 'react';
import { Button } from '@deqah/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@deqah/ui/primitives/dialog';
import { Label } from '@deqah/ui/primitives/label';
import { Textarea } from '@deqah/ui/primitives/textarea';
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

  const isValid = reason.trim().length >= 10;

  const submit = () => {
    if (!isValid) return;
    mutation.mutate(
      { invoiceId: invoice.id, reason: reason.trim() },
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
          <DialogTitle>Waive invoice</DialogTitle>
          <DialogDescription>
            Voids invoice{' '}
            <span className="font-mono text-xs">{invoice.id.slice(0, 8)}…</span> for{' '}
            <span className="font-semibold">
              {Number(invoice.amount).toFixed(2)} {invoice.currency}
            </span>
            . Only DUE/FAILED invoices can be waived. No money moves; PAID invoices require a refund instead.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="wv-reason">Reason (min 10 chars)</Label>
          <Textarea
            id="wv-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for waiving this invoice…"
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
            {mutation.isPending ? 'Waiving…' : 'Waive invoice'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
