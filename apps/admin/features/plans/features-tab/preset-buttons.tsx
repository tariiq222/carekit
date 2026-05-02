'use client';
import { Button } from '@deqah/ui/primitives/button';
import { applyPreset, type PlanLimits, type PresetKind } from './presets';

type Props = {
  limits: PlanLimits;
  onLimitsChange: (next: PlanLimits) => void;
};

const PRESETS: { kind: PresetKind; label: string }[] = [
  { kind: 'PRO', label: 'Apply PRO preset' },
  { kind: 'ENTERPRISE', label: 'Apply ENTERPRISE preset' },
  { kind: 'DISABLE_ALL', label: 'Disable all' },
];

export function PresetButtons({ limits, onLimitsChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {PRESETS.map((p) => (
        <Button
          key={p.kind}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onLimitsChange(applyPreset(limits, p.kind))}
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}
