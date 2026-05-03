'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ApiError } from '@/lib/api-client';
import {
  getNotificationsConfig,
  updateNotificationsConfig,
  type NotificationChannel,
  type QuietHours,
  type FcmCredentials,
  type NotificationDefaults,
} from '@/features/notifications-settings/notifications-settings.api';

const ALL_CHANNELS: NotificationChannel[] = ['EMAIL', 'SMS', 'PUSH', 'INAPP'];

const COMMON_TIMEZONES = [
  'Asia/Riyadh',
  'Asia/Dubai',
  'Asia/Kuwait',
  'Africa/Cairo',
  'UTC',
];

const inputClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

export default function NotificationsSettingsPage() {
  const t = useTranslations('settings.notifications');

  const [data, setData] = useState<NotificationDefaults | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [quietHours, setQuietHours] = useState<QuietHours>({
    startHour: 22,
    endHour: 8,
    timezone: 'Asia/Riyadh',
  });
  const [fcm, setFcm] = useState<FcmCredentials>({
    serverKey: '',
    projectId: '',
    clientEmail: '',
  });

  useEffect(() => {
    const load = async () => {
      try {
        const result = await getNotificationsConfig();
        setData(result);
        setChannels(result.defaultChannels);
        setQuietHours(result.quietHours);
        setFcm(result.fcm);
      } catch (err) {
        setError(
          err instanceof ApiError ? err.message : t('loadError'),
        );
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [t]);

  const toggleChannel = (ch: NotificationChannel) => {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch],
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await updateNotificationsConfig({
        defaultChannels: channels,
        quietHours,
        fcm: {
          projectId: fcm.projectId || undefined,
          clientEmail: fcm.clientEmail || undefined,
          serverKey:
            fcm.serverKey && fcm.serverKey !== '***'
              ? fcm.serverKey
              : undefined,
        },
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('loadError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-32 rounded-lg border border-border bg-muted animate-pulse"
          />
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
        <h2 className="text-lg font-semibold">{t('title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      {/* Default Channels */}
      <div className="rounded-lg border border-border p-6 space-y-4">
        <h3 className="font-medium">{t('defaultChannels.title')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('defaultChannels.description')}
        </p>
        <div className="flex flex-wrap gap-4">
          {ALL_CHANNELS.map((ch) => (
            <label key={ch} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={channels.includes(ch)}
                onChange={() => toggleChannel(ch)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              <span className="text-sm font-medium">{ch}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Quiet Hours */}
      <div className="rounded-lg border border-border p-6 space-y-4">
        <h3 className="font-medium">{t('quietHours.title')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('quietHours.description')}
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">
              {t('quietHours.startHour')}
            </label>
            <input
              type="number"
              min={0}
              max={23}
              value={quietHours.startHour}
              onChange={(e) =>
                setQuietHours((prev) => ({
                  ...prev,
                  startHour: Number(e.target.value),
                }))
              }
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">
              {t('quietHours.endHour')}
            </label>
            <input
              type="number"
              min={0}
              max={23}
              value={quietHours.endHour}
              onChange={(e) =>
                setQuietHours((prev) => ({
                  ...prev,
                  endHour: Number(e.target.value),
                }))
              }
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">
              {t('quietHours.timezone')}
            </label>
            <select
              value={quietHours.timezone}
              onChange={(e) =>
                setQuietHours((prev) => ({ ...prev, timezone: e.target.value }))
              }
              className={inputClass}
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* FCM Credentials */}
      <div className="rounded-lg border border-border p-6 space-y-4">
        <h3 className="font-medium">{t('fcm.title')}</h3>
        <p className="text-sm text-muted-foreground">{t('fcm.description')}</p>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">{t('fcm.projectId')}</label>
            <input
              type="text"
              value={fcm.projectId}
              onChange={(e) =>
                setFcm((prev) => ({ ...prev, projectId: e.target.value }))
              }
              placeholder="my-firebase-project"
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">
              {t('fcm.clientEmail')}
            </label>
            <input
              type="email"
              value={fcm.clientEmail}
              onChange={(e) =>
                setFcm((prev) => ({ ...prev, clientEmail: e.target.value }))
              }
              placeholder="firebase-adminsdk@project.iam.gserviceaccount.com"
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">{t('fcm.serverKey')}</label>
            <input
              type="password"
              value={fcm.serverKey === '***' ? '' : fcm.serverKey}
              onChange={(e) =>
                setFcm((prev) => ({ ...prev, serverKey: e.target.value }))
              }
              placeholder={
                fcm.serverKey === '***'
                  ? t('fcm.serverKeyPlaceholder')
                  : '-----BEGIN RSA PRIVATE KEY-----'
              }
              className={`${inputClass} font-mono`}
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
          {t('saveSuccess')}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? t('saving') : t('save')}
        </button>
      </div>
    </form>
  );
}
