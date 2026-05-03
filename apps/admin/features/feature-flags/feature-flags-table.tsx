'use client';
import { useState } from 'react';
import { useFeatureFlags, useUpdateFeatureFlag } from './use-feature-flags';

// Sentinel UUID used for platform-level (non-org-specific) toggles
const PLATFORM_ORG_ID = '00000000-0000-0000-0000-000000000000';

export function FeatureFlagsTable() {
  const { data: flags, isLoading } = useFeatureFlags();
  const toggle = useUpdateFeatureFlag();
  const [reason, setReason] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  return (
    <div className="space-y-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-border border-b text-left">
            <th className="pb-2 font-medium">Key</th>
            <th className="pb-2 font-medium">Platform Default</th>
            <th className="pb-2 font-medium">Overrides</th>
            <th className="pb-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {flags?.map((flag) => (
            <tr key={flag.key} className="border-border/40 border-b py-2">
              <td className="py-2 font-mono text-xs">{flag.key}</td>
              <td className="py-2">
                <span
                  className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                    flag.enabledByDefault
                      ? 'bg-green-100 text-green-800'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {flag.enabledByDefault ? 'ON' : 'OFF'}
                </span>
              </td>
              <td className="text-muted-foreground py-2 text-xs">
                {flag.overrides.length} org(s)
              </td>
              <td className="py-2">
                {editingKey === flag.key ? (
                  <div className="flex items-center gap-2">
                    <input
                      className="border-border w-48 rounded border px-2 py-1 text-xs"
                      placeholder="Reason (min 10 chars)"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <button
                      className="bg-primary text-primary-foreground rounded px-2 py-1 text-xs disabled:opacity-50"
                      disabled={reason.length < 10 || toggle.isPending}
                      onClick={() => {
                        toggle.mutate(
                          {
                            key: flag.key,
                            body: {
                              organizationId: PLATFORM_ORG_ID,
                              enabled: !flag.enabledByDefault,
                              reason,
                            },
                          },
                          {
                            onSuccess: () => {
                              setEditingKey(null);
                              setReason('');
                            },
                          },
                        );
                      }}
                    >
                      {toggle.isPending ? '…' : 'Confirm'}
                    </button>
                    <button
                      className="text-muted-foreground text-xs"
                      onClick={() => {
                        setEditingKey(null);
                        setReason('');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className="text-primary text-xs hover:underline"
                    onClick={() => setEditingKey(flag.key)}
                  >
                    Toggle
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
