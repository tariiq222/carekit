'use client';

import { Button } from '@deqah/ui/primitives/button';
import { Input } from '@deqah/ui/primitives/input';

interface Props {
  search: string;
  onSearchChange: (value: string) => void;
  organizationId: string;
  onOrganizationIdChange: (value: string) => void;
  onReset: () => void;
}

export function UsersFilterBar({
  search,
  onSearchChange,
  organizationId,
  onOrganizationIdChange,
  onReset,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/50 px-4 py-3">
      <Input
        placeholder="Search by email or name"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="max-w-sm"
      />
      <Input
        placeholder="Organization ID (UUID, optional)"
        value={organizationId}
        onChange={(e) => onOrganizationIdChange(e.target.value)}
        className="max-w-sm font-mono text-xs"
      />
      <Button variant="ghost" size="sm" onClick={onReset}>
        Reset
      </Button>
    </div>
  );
}
