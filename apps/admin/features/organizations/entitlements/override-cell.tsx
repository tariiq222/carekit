'use client';
import { Badge } from '@deqah/ui/primitives/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@deqah/ui/primitives/select';
import type { OverrideMode } from './upsert-override.api';

interface Props {
  value: OverrideMode;
  initial: OverrideMode;
  onChange: (next: OverrideMode) => void;
  disabled?: boolean;
}

export function OverrideCell({ value, initial, onChange, disabled }: Props) {
  const modified = value !== initial;
  return (
    <div className="flex items-center gap-2">
      <Select value={value} onValueChange={(v) => onChange(v as OverrideMode)} disabled={disabled}>
        <SelectTrigger className="h-8 w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="INHERIT">Inherit</SelectItem>
          <SelectItem value="FORCE_ON">Force ON</SelectItem>
          <SelectItem value="FORCE_OFF">Force OFF</SelectItem>
        </SelectContent>
      </Select>
      {modified && (
        <Badge variant="secondary" className="text-xs">Modified</Badge>
      )}
    </div>
  );
}
