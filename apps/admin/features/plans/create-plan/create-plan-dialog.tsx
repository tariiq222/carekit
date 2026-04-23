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
import { useCreatePlan } from './use-create-plan';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_FORM = {
  slug: '' as 'BASIC' | 'PRO' | 'ENTERPRISE' | '',
  nameAr: '',
  nameEn: '',
  priceMonthly: '',
  priceAnnual: '',
  currency: 'SAR',
  reason: '',
};

export function CreatePlanDialog({ open, onOpenChange }: Props) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const mutation = useCreatePlan();

  const isValid =
    form.slug !== '' &&
    form.nameAr.trim().length > 0 &&
    form.nameEn.trim().length > 0 &&
    form.priceMonthly !== '' &&
    form.priceAnnual !== '' &&
    form.reason.trim().length >= 10;

  const reset = () => setForm(DEFAULT_FORM);

  const submit = () => {
    if (!isValid || form.slug === '') return;
    mutation.mutate(
      {
        slug: form.slug,
        nameAr: form.nameAr.trim(),
        nameEn: form.nameEn.trim(),
        priceMonthly: Number(form.priceMonthly),
        priceAnnual: Number(form.priceAnnual),
        currency: form.currency.trim() || 'SAR',
        limits: { maxBranches: 0, maxEmployees: 0 },
        isActive: true,
        reason: form.reason.trim(),
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          reset();
        },
      },
    );
  };

  const set = (field: keyof typeof DEFAULT_FORM) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create plan</DialogTitle>
          <DialogDescription>
            Add a new subscription plan. Reason is required and written to the audit log.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cp-slug">Slug</Label>
            <Select
              value={form.slug}
              onValueChange={(v) => set('slug')(v as 'BASIC' | 'PRO' | 'ENTERPRISE')}
            >
              <SelectTrigger id="cp-slug">
                <SelectValue placeholder="Select slug…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BASIC">BASIC</SelectItem>
                <SelectItem value="PRO">PRO</SelectItem>
                <SelectItem value="ENTERPRISE">ENTERPRISE</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cp-nameAr">Name (Arabic)</Label>
            <Input
              id="cp-nameAr"
              value={form.nameAr}
              onChange={(e) => set('nameAr')(e.target.value)}
              placeholder="اسم الخطة"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cp-nameEn">Name (English)</Label>
            <Input
              id="cp-nameEn"
              value={form.nameEn}
              onChange={(e) => set('nameEn')(e.target.value)}
              placeholder="Plan name"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cp-monthly">Monthly price</Label>
              <Input
                id="cp-monthly"
                type="number"
                min={0}
                value={form.priceMonthly}
                onChange={(e) => set('priceMonthly')(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-annual">Annual price</Label>
              <Input
                id="cp-annual"
                type="number"
                min={0}
                value={form.priceAnnual}
                onChange={(e) => set('priceAnnual')(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cp-currency">Currency</Label>
            <Input
              id="cp-currency"
              value={form.currency}
              onChange={(e) => set('currency')(e.target.value)}
              placeholder="SAR"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cp-reason">Reason (min 10 chars)</Label>
            <Textarea
              id="cp-reason"
              rows={3}
              value={form.reason}
              onChange={(e) => set('reason')(e.target.value)}
              placeholder="Reason for creating this plan…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              reset();
            }}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={mutation.isPending || !isValid}>
            {mutation.isPending ? 'Creating…' : 'Create plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
