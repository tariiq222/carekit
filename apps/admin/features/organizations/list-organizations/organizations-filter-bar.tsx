'use client';

import { Button } from '@carekit/ui/primitives/button';
import { Input } from '@carekit/ui/primitives/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@carekit/ui/primitives/select';

export type SuspendedFilter = 'all' | 'true' | 'false';

interface Props {
  search: string;
  onSearchChange: (next: string) => void;
  suspended: SuspendedFilter;
  onSuspendedChange: (next: SuspendedFilter) => void;
  onReset: () => void;
}

export function OrganizationsFilterBar({
  search,
  onSearchChange,
  suspended,
  onSuspendedChange,
  onReset,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/50 px-4 py-3">
      <Input
        placeholder="Search by slug, Arabic or English name"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="max-w-sm"
      />
      <Select value={suspended} onValueChange={(v) => onSuspendedChange(v as SuspendedFilter)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="false">Active only</SelectItem>
          <SelectItem value="true">Suspended only</SelectItem>
        </SelectContent>
      </Select>
      <Button variant="ghost" size="sm" onClick={onReset}>
        Reset
      </Button>
    </div>
  );
}
