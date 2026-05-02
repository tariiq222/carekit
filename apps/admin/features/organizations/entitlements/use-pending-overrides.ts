'use client';
import { useState, useCallback } from 'react';
import type { FeatureKey } from '@deqah/shared';
import type { OverrideMode } from './upsert-override.api';

export type PendingMap = Partial<Record<FeatureKey, OverrideMode>>;

export function usePendingOverrides(initial: PendingMap = {}) {
  const [pending, setPending] = useState<PendingMap>(initial);

  const setMode = useCallback((key: FeatureKey, mode: OverrideMode) => {
    setPending((prev) => {
      const next = { ...prev };
      if (mode === 'INHERIT') delete next[key];
      else next[key] = mode;
      return next;
    });
  }, []);

  const reset = useCallback(() => setPending(initial), [initial]);

  return { pending, setMode, reset, dirtyCount: Object.keys(pending).length };
}
