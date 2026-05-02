'use client';
import { Input } from '@deqah/ui/primitives/input';
import { Label } from '@deqah/ui/primitives/label';

type Props = { value: string; onChange: (v: string) => void };

export function FeatureSearch({ value, onChange }: Props) {
  return (
    <div className="space-y-1">
      <Label htmlFor="feature-search" className="text-sm text-muted-foreground">
        Search features
      </Label>
      <Input
        id="feature-search"
        type="search"
        placeholder="Filter by name or description..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
