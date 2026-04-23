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
import { Textarea } from '@carekit/ui/primitives/textarea';
import type { PlanRow } from '../types';
import { useUpdatePlan } from './use-update-plan';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: PlanRow;
}

interface FormState {
  nameAr: string;
  nameEn: string;
  priceMonthly: string;
  priceAnnual: string;
  currency: string;
  reason: string;
}

export function UpdatePlanDialog({ open, onOpenChange, plan }: Props) {
  const [form, setForm] = useState<FormState>({
    nameAr: plan.nameAr,
    nameEn: plan.nameEn,
    priceMonthly: String(plan.priceMonthly),
    priceAnnual: String(plan.priceAnnual),
    currency: plan.currency,
    reason: '',
  });

  useEffect(() => {
    if (open) {
      setForm({
        nameAr: plan.nameAr,
        nameEn: plan.nameEn,
        priceMonthly: String(plan.priceMonthly),
        priceAnnual: String(plan.priceAnnual),
        currency: plan.currency,
        reason: '',
      });
    }
  }, [open, plan]);

  const mutation = useUpdatePlan();

  const isValid =
    form.nameAr.trim().length > 0 &&
    form.nameEn.trim().length > 0 &&
    form.priceMonthly !== '' &&
    form.priceAnnual !== '' &&
    form.reason.trim().length >= 10;

  const set = (field: keyof FormState) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const submit = () => {
    if (!isValid) return;
    mutation.mutate(
      {
        planId: plan.id,
        nameAr: form.nameAr.trim(),
        nameEn: form.nameEn.trim(),
        priceMonthly: Number(form.priceMonthly),
        priceAnnual: Number(form.priceAnnual),
        currency: form.currency.trim() || 'SAR',
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
          <DialogTitle>Edit plan — {plan.slug}</DialogTitle>
          <DialogDescription>
            Update plan details. Slug cannot be changed after creation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="up-nameAr">Name (Arabic)</Label>
            <Input
              id="up-nameAr"
              value={form.nameAr}
              onChange={(e) => set('nameAr')(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="up-nameEn">Name (English)</Label>
            <Input
              id="up-nameEn"
              value={form.nameEn}
              onChange={(e) => set('nameEn')(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="up-monthly">Monthly price</Label>
              <Input
                id="up-monthly"
                type="number"
                min={0}
                value={form.priceMonthly}
                onChange={(e) => set('priceMonthly')(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="up-annual">Annual price</Label>
              <Input
                id="up-annual"
                type="number"
                min={0}
                value={form.priceAnnual}
                onChange={(e) => set('priceAnnual')(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="up-currency">Currency</Label>
            <Input
              id="up-currency"
              value={form.currency}
              onChange={(e) => set('currency')(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="up-reason">Reason (min 10 chars)</Label>
            <Textarea
              id="up-reason"
              rows={3}
              value={form.reason}
              onChange={(e) => set('reason')(e.target.value)}
              placeholder="Reason for updating this plan…"
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
