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
import { useResetUserPassword } from './use-reset-user-password';

export function ResetPasswordDialog({
  userId,
  userEmail,
}: {
  userId: string;
  userEmail: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const mutation = useResetUserPassword();

  const submit = () => {
    mutation.mutate(
      { userId, reason },
      {
        onSuccess: () => {
          setOpen(false);
          setReason('');
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Reset password
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password for {userEmail}</DialogTitle>
          <DialogDescription>
            Issues a secure temporary password and emails it to the user. Reason is required
            (min 10 chars) and logged to the audit trail.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="e.g., User locked out, support call #1234"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={mutation.isPending || reason.trim().length < 10}
          >
            {mutation.isPending ? 'Resetting…' : 'Confirm reset'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
