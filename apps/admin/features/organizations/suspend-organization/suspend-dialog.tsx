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
  DialogTrigger,
} from '@carekit/ui/primitives/dialog';
import { Label } from '@carekit/ui/primitives/label';
import { Textarea } from '@carekit/ui/primitives/textarea';
import { useSuspendOrganization } from './use-suspend-organization';

export function SuspendDialog({ organizationId }: { organizationId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const mutation = useSuspendOrganization(organizationId);

  const submit = () => {
    mutation.mutate(reason, {
      onSuccess: () => {
        setOpen(false);
        setReason('');
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">Suspend</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suspend organization</DialogTitle>
          <DialogDescription>
            Members will be signed out within 30 seconds. Reason is required (min 10 characters)
            and written to the audit log.
          </DialogDescription>
        </DialogHeader>
        <Label htmlFor="suspend-reason">Reason</Label>
        <Textarea
          id="suspend-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="e.g., Non-payment past 60-day grace period"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={mutation.isPending || reason.trim().length < 10}
          >
            {mutation.isPending ? 'Suspending…' : 'Confirm suspend'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
