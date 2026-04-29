'use client';

import { FormEvent, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@carekit/ui/primitives/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@carekit/ui/primitives/dialog';
import { Label } from '@carekit/ui/primitives/label';
import { Textarea } from '@carekit/ui/primitives/textarea';
import { useArchiveOrganization } from './use-archive-organization';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationName: string;
}

export function ArchiveDialog({ open, onOpenChange, organizationId, organizationName }: Props) {
  const t = useTranslations('organizations.archive');
  const [reason, setReason] = useState('');
  const mutation = useArchiveOrganization(organizationId);
  const canSubmit = reason.trim().length >= 10;

  const reset = () => {
    setReason('');
    mutation.reset();
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && !mutation.isPending) reset();
    onOpenChange(next);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || mutation.isPending) return;
    mutation.mutate(reason.trim(), {
      onSuccess: () => handleOpenChange(false),
    });
  };

  const errorMessage = mutation.error instanceof Error ? mutation.error.message : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>{t('description', { name: organizationName })}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="archive-reason">{t('reason')}</Label>
              <Textarea
                id="archive-reason"
                rows={4}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
            {errorMessage ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {errorMessage}
              </div>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={mutation.isPending}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" variant="destructive" disabled={mutation.isPending || !canSubmit}>
              {mutation.isPending ? t('submitting') : t('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
