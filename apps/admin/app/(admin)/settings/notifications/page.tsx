'use client';

import { useState, useEffect } from 'react';
import { adminRequest } from '@/lib/api-client';
import { ApiError } from '@/lib/api-client';

type NotificationChannel = 'EMAIL' | 'SMS' | 'PUSH' | 'INAPP';

interface QuietHours {
  startHour: number;
  endHour: number;
  timezone: string;
}

interface FcmCredentials {
  serverKey: string;
  projectId: string;
  clientEmail: string;
}

interface NotificationDefaults {
  defaultChannels: NotificationChannel[];
  quietHours: QuietHours;
  fcm: FcmCredentials;
}

const ALL_CHANNELS: NotificationChannel[] = ['EMAIL', 'SMS', 'PUSH', 'INAPP'];

const COMMON_TIMEZONES = [
  'Asia/Riyadh',
  'Asia/Dubai',
  'Asia/Kuwait',
  'Africa/Cairo',
  'UTC',
];

export default function NotificationsSettingsPage() {
  const [data, setData] = useState<NotificationDefaults | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [quietHours, setQuietHours] = useState<QuietHours>({ startHour: 22, endHour: 8, timezone: 'Asia/Riyadh' });
  const [fcm, setFcm] = useState<FcmCredentials>({ serverKey: '', projectId: '', clientEmail: '' });

  useEffect(() => {
    const load = async () => {
      try {
        const result = await adminRequest<NotificationDefaults>('/notifications-config');
        setData(result);
        setChannels(result.defaultChannels);
        setQuietHours(result.quietHours);
        setFcm(result.fcm);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load notification settings');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const toggleChannel = (ch: NotificationChannel) => {
    setChannels(prev =>
      prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch],
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await adminRequest('/notifications-config', {
        method: 'PUT',
        body: JSON.stringify({
          defaultChannels: channels,
          quietHours,
          fcm: {
            projectId: fcm.projectId || undefined,
            clientEmail: fcm.clientEmail || undefined,
            serverKey: fcm.serverKey && fcm.serverKey !== '***' ? fcm.serverKey : undefined,
          },
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 rounded-lg border border-border bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data && error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Notification Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure platform-wide notification defaults and FCM push credentials.
        </p>
      </div>

      {/* Default Channels */}
      <div className="rounded-lg border border-border p-6 space-y-4">
        <h3 className="font-medium">Default Channels</h3>
        <p className="text-sm text-muted-foreground">
          Select which notification channels are enabled by default for all tenants.
        </p>
        <div className="flex flex-wrap gap-4">
          {ALL_CHANNELS.map(ch => (
            <label key={ch} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={channels.includes(ch)}
                onChange={() => toggleChannel(ch)}
                className="rounded border-input"
              />
              <span className="text-sm font-medium">{ch}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Quiet Hours */}
      <div className="rounded-lg border border-border p-6 space-y-4">
        <h3 className="font-medium">Quiet Hours</h3>
        <p className="text-sm text-muted-foreground">
          Suppress non-urgent push notifications during these hours.
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Start Hour (0–23)</label>
            <input
              type="number"
              min={0}
              max={23}
              value={quietHours.startHour}
              onChange={e => setQuietHours(prev => ({ ...prev, startHour: Number(e.target.value) }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">End Hour (0–23)</label>
            <input
              type="number"
              min={0}
              max={23}
              value={quietHours.endHour}
              onChange={e => setQuietHours(prev => ({ ...prev, endHour: Number(e.target.value) }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Timezone</label>
            <select
              value={quietHours.timezone}
              onChange={e => setQuietHours(prev => ({ ...prev, timezone: e.target.value }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {COMMON_TIMEZONES.map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* FCM Credentials */}
      <div className="rounded-lg border border-border p-6 space-y-4">
        <h3 className="font-medium">FCM Credentials</h3>
        <p className="text-sm text-muted-foreground">
          Firebase Cloud Messaging credentials for push notifications. Values are encrypted at rest.
          Leave Server Key blank to keep the existing value.
        </p>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Project ID</label>
            <input
              type="text"
              value={fcm.projectId}
              onChange={e => setFcm(prev => ({ ...prev, projectId: e.target.value }))}
              placeholder="my-firebase-project"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Client Email</label>
            <input
              type="email"
              value={fcm.clientEmail}
              onChange={e => setFcm(prev => ({ ...prev, clientEmail: e.target.value }))}
              placeholder="firebase-adminsdk@project.iam.gserviceaccount.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Server Key (Private Key)</label>
            <input
              type="password"
              value={fcm.serverKey === '***' ? '' : fcm.serverKey}
              onChange={e => setFcm(prev => ({ ...prev, serverKey: e.target.value }))}
              placeholder={fcm.serverKey === '***' ? '(currently set — leave blank to keep)' : '-----BEGIN RSA PRIVATE KEY-----'}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success">
          Notification settings saved successfully.
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save settings'}
        </button>
      </div>
    </form>
  );
}
