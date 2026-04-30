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
  DialogTrigger,
} from '@deqah/ui/primitives/dialog';
import { Textarea } from '@deqah/ui/primitives/textarea';
import { useReinstateOrganization } from './use-reinstate-organization';

export function ReinstateDialog({ organizationId }: { organizationId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const mutation = useReinstateOrganization(organizationId);

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
        <Button variant="outline">Reinstate</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reinstate organization</DialogTitle>
          <DialogDescription>
            Reason for reinstatement (optional, written to audit log).
          </DialogDescription>
        </DialogHeader>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Reinstating…' : 'Confirm reinstate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
