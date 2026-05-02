'use client';
import { useState } from 'react';
import { Button } from '@deqah/ui/primitives/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@deqah/ui/primitives/dialog';
import { Label } from '@deqah/ui/primitives/label';
import { Textarea } from '@deqah/ui/primitives/textarea';
import type { FeatureKey } from '@deqah/shared';
import type { OverrideMode } from './upsert-override.api';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  changes: Array<{ key: FeatureKey; mode: OverrideMode }>;
  onConfirm: (reason: string) => Promise<void>;
}

const MODE_LABEL: Record<OverrideMode, string> = {
  INHERIT: 'Inherit',
  FORCE_ON: 'Force ON',
  FORCE_OFF: 'Force OFF',
};

export function SaveOverridesDialog({ open, onOpenChange, changes, onConfirm }: Props) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const validReason = reason.trim().length >= 10;
  const canSubmit = validReason && !submitting && changes.length > 0;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
      setReason('');
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save entitlement overrides</DialogTitle>
          <DialogDescription>
            {changes.length} pending change{changes.length === 1 ? '' : 's'} will be applied immediately.
          </DialogDescription>
        </DialogHeader>

        <ul className="text-sm space-y-1 mt-2 max-h-48 overflow-y-auto">
          {changes.map((c) => (
            <li key={c.key} className="flex justify-between border-b py-1">
              <span>{c.key}</span>
              <span className="font-medium">{MODE_LABEL[c.mode]}</span>
            </li>
          ))}
        </ul>

        <div className="space-y-1 mt-4">
          <Label htmlFor="reason">Reason</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Pilot customer X requires coupons on Basic plan"
            rows={3}
          />
          <p className="text-xs text-muted-foreground">≥ 10 characters required for the audit log.</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!canSubmit}>
            {submitting ? 'Saving…' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
