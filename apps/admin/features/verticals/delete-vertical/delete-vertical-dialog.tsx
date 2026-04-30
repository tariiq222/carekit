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
import type { VerticalRow } from '../types';
import { useDeleteVertical } from './use-delete-vertical';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vertical: VerticalRow;
}

export function DeleteVerticalDialog({ open, onOpenChange, vertical }: Props) {
  const [reason, setReason] = useState('');
  const mutation = useDeleteVertical();

  const isValid = reason.trim().length >= 10;

  const submit = () => {
    if (!isValid) return;
    mutation.mutate(
      { verticalId: vertical.id, reason: reason.trim() },
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
          <DialogTitle>Delete vertical</DialogTitle>
          <DialogDescription>
            You are about to delete{' '}
            <span className="font-semibold">
              {vertical.nameEn} ({vertical.slug})
            </span>
            . This action cannot be undone. Reason is required and written to the audit log.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="dv-reason">Reason (min 10 chars)</Label>
          <Textarea
            id="dv-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for deleting this vertical…"
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
            {mutation.isPending ? 'Deleting…' : 'Delete vertical'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
