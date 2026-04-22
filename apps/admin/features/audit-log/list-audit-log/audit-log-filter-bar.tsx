'use client';

import { Button } from '@carekit/ui/primitives/button';
import { Input } from '@carekit/ui/primitives/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@carekit/ui/primitives/select';

const ACTION_TYPES = [
  'SUSPEND_ORG',
  'REINSTATE_ORG',
  'IMPERSONATE_START',
  'IMPERSONATE_END',
  'RESET_PASSWORD',
  'PLAN_CREATE',
  'PLAN_UPDATE',
  'PLAN_DELETE',
  'VERTICAL_CREATE',
  'VERTICAL_UPDATE',
  'VERTICAL_DELETE',
] as const;

interface Props {
  actionType: string;
  onActionTypeChange: (value: string) => void;
  organizationId: string;
  onOrganizationIdChange: (value: string) => void;
  onReset: () => void;
}

export function AuditLogFilterBar({
  actionType,
  onActionTypeChange,
  organizationId,
  onOrganizationIdChange,
  onReset,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/50 px-4 py-3">
      <Select value={actionType} onValueChange={onActionTypeChange}>
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="Action type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All action types</SelectItem>
          {ACTION_TYPES.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        placeholder="Organization ID (UUID)"
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
