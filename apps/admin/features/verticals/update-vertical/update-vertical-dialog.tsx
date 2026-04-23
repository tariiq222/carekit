'use client';

import { useEffect, useState } from 'react';
import { Button } from '@carekit/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@carekit/ui/primitives/dialog';
import { Input } from '@carekit/ui/primitives/input';
import { Label } from '@carekit/ui/primitives/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@carekit/ui/primitives/select';
import { Textarea } from '@carekit/ui/primitives/textarea';
import type { VerticalRow } from '../types';
import { useUpdateVertical } from './use-update-vertical';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vertical: VerticalRow;
}

interface FormState {
  nameAr: string;
  nameEn: string;
  templateFamily: 'MEDICAL' | 'CONSULTING' | 'SALON' | 'FITNESS';
  descriptionAr: string;
  descriptionEn: string;
  reason: string;
}

export function UpdateVerticalDialog({ open, onOpenChange, vertical }: Props) {
  const [form, setForm] = useState<FormState>({
    nameAr: vertical.nameAr,
    nameEn: vertical.nameEn,
    templateFamily: vertical.templateFamily as 'MEDICAL' | 'CONSULTING' | 'SALON' | 'FITNESS',
    descriptionAr: vertical.descriptionAr ?? '',
    descriptionEn: vertical.descriptionEn ?? '',
    reason: '',
  });

  useEffect(() => {
    if (open) {
      setForm({
        nameAr: vertical.nameAr,
        nameEn: vertical.nameEn,
        templateFamily: vertical.templateFamily as 'MEDICAL' | 'CONSULTING' | 'SALON' | 'FITNESS',
        descriptionAr: vertical.descriptionAr ?? '',
        descriptionEn: vertical.descriptionEn ?? '',
        reason: '',
      });
    }
  }, [open, vertical]);

  const mutation = useUpdateVertical();

  const isValid =
    form.nameAr.trim().length > 0 &&
    form.nameEn.trim().length > 0 &&
    form.reason.trim().length >= 10;

  const set = (field: keyof FormState) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const submit = () => {
    if (!isValid) return;
    mutation.mutate(
      {
        verticalId: vertical.id,
        nameAr: form.nameAr.trim(),
        nameEn: form.nameEn.trim(),
        templateFamily: form.templateFamily,
        descriptionAr: form.descriptionAr.trim() || null,
        descriptionEn: form.descriptionEn.trim() || null,
        reason: form.reason.trim(),
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit vertical — {vertical.slug}</DialogTitle>
          <DialogDescription>
            Update vertical details. Slug cannot be changed after creation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="uv-nameAr">Name (Arabic)</Label>
            <Input
              id="uv-nameAr"
              value={form.nameAr}
              onChange={(e) => set('nameAr')(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="uv-nameEn">Name (English)</Label>
            <Input
              id="uv-nameEn"
              value={form.nameEn}
              onChange={(e) => set('nameEn')(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="uv-family">Template family</Label>
            <Select
              value={form.templateFamily}
              onValueChange={(v) =>
                set('templateFamily')(v as 'MEDICAL' | 'CONSULTING' | 'SALON' | 'FITNESS')
              }
            >
              <SelectTrigger id="uv-family">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MEDICAL">MEDICAL</SelectItem>
                <SelectItem value="CONSULTING">CONSULTING</SelectItem>
                <SelectItem value="SALON">SALON</SelectItem>
                <SelectItem value="FITNESS">FITNESS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="uv-descAr">Description (Arabic, optional)</Label>
            <Textarea
              id="uv-descAr"
              rows={2}
              value={form.descriptionAr}
              onChange={(e) => set('descriptionAr')(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="uv-descEn">Description (English, optional)</Label>
            <Textarea
              id="uv-descEn"
              rows={2}
              value={form.descriptionEn}
              onChange={(e) => set('descriptionEn')(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="uv-reason">Reason (min 10 chars)</Label>
            <Textarea
              id="uv-reason"
              rows={3}
              value={form.reason}
              onChange={(e) => set('reason')(e.target.value)}
              placeholder="Reason for updating this vertical…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={mutation.isPending || !isValid}>
            {mutation.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
