'use client';

import { Button } from '@carekit/ui/primitives/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@carekit/ui/primitives/select';
import type { SubscriptionStatus } from '../types';

export type StatusFilter = 'all' | SubscriptionStatus;

interface Props {
  status: StatusFilter;
  onStatusChange: (next: StatusFilter) => void;
  onReset: () => void;
}

const STATUSES: SubscriptionStatus[] = [
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'SUSPENDED',
  'CANCELED',
];

export function SubscriptionsFilterBar({ status, onStatusChange, onReset }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/50 px-4 py-3">
      <Select value={status} onValueChange={(v) => onStatusChange(v as StatusFilter)}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {s.replace('_', ' ')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="ghost" size="sm" onClick={onReset}>
        Reset
      </Button>
    </div>
  );
}
