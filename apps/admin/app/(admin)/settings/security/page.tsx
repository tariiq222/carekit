'use client';
import { useEffect, useState } from 'react';
import { adminRequest } from '@/lib/api-client';

interface SecuritySettings {
  sessionTtlMinutes: number;
  require2fa: boolean;
  ipAllowlist: string[];
}

export default function SecuritySettingsPage() {
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminRequest<SecuritySettings>('/admin/settings/security').then(setSettings).catch(console.error);
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await adminRequest('/admin/settings/security', { method: 'PUT', body: JSON.stringify(settings) });
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <p className="text-muted-foreground text-sm">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Security Settings</h1>
        <p className="text-muted-foreground text-sm">Super-admin session and access controls</p>
      </div>

      <div className="space-y-4 max-w-lg">
        <div>
          <label className="block text-sm font-medium mb-1">Session TTL (minutes)</label>
          <input
            type="number"
            min={15}
            max={1440}
            className="w-full border border-border rounded px-3 py-2 text-sm"
            value={settings.sessionTtlMinutes}
            onChange={(e) => setSettings({ ...settings, sessionTtlMinutes: Number(e.target.value) })}
          />
          <p className="text-xs text-muted-foreground mt-1">JWT lifetime for super-admin sessions (15–1440 min)</p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="require2fa"
            checked={settings.require2fa}
            onChange={(e) => setSettings({ ...settings, require2fa: e.target.checked })}
          />
          <label htmlFor="require2fa" className="text-sm font-medium">Require 2FA for all super-admins</label>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">IP Allowlist (one CIDR per line, empty = allow all)</label>
          <textarea
            className="w-full border border-border rounded px-3 py-2 text-sm font-mono"
            rows={4}
            value={settings.ipAllowlist.join('\n')}
            onChange={(e) => setSettings({ ...settings, ipAllowlist: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
          />
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="bg-primary text-primary-foreground rounded px-4 py-2 text-sm disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Security Settings'}
        </button>
      </div>
    </div>
  );
}
