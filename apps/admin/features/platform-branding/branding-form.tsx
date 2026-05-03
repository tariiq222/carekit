'use client';

import { useEffect, useState } from 'react';
import { getPlatformBrand, updatePlatformBrand, type PlatformBrand } from './platform-branding.api';
import { ApiError } from '@/lib/api-client';

const DEFAULT_BRAND: PlatformBrand = {
  logoUrl: '',
  primaryColor: '#354FD8',
  accentColor: '#82CC17',
  locale: {
    default: 'ar',
    rtlDefault: true,
    dateFormat: 'dd/MM/yyyy',
    currencyFormat: 'SAR',
  },
};

export function BrandingForm() {
  const [form, setForm] = useState<PlatformBrand>(DEFAULT_BRAND);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    getPlatformBrand()
      .then(setForm)
      .catch((err) => {
        setLoadError(err instanceof ApiError ? err.message : 'Failed to load branding settings.');
      });
  }, []);

  function setField<K extends keyof PlatformBrand>(key: K, value: PlatformBrand[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaveMsg(null);
  }

  function setLocaleField<K extends keyof PlatformBrand['locale']>(key: K, value: PlatformBrand['locale'][K]) {
    setForm((prev) => ({ ...prev, locale: { ...prev.locale, [key]: value } }));
    setSaveMsg(null);
  }

  async function handleSave() {
    setSaving(true);
    setSaveMsg(null);
    try {
      await updatePlatformBrand(form);
      setSaveMsg({ ok: true, text: 'Branding settings saved.' });
    } catch (err) {
      setSaveMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Save failed.' });
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {loadError}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Brand Colors + Logo */}
      <div className="rounded-lg border border-border p-6 space-y-4">
        <div>
          <h3 className="font-medium">Brand Identity</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Platform logo URL and default brand colors shown in admin and email templates.
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="logoUrl" className="text-sm font-medium">Logo URL</label>
          <input
            id="logoUrl"
            type="url"
            value={form.logoUrl}
            onChange={(e) => setField('logoUrl', e.target.value)}
            placeholder="https://cdn.example.com/logo.svg"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="primaryColor" className="text-sm font-medium">Primary Color</label>
            <div className="flex items-center gap-2">
              <input
                id="primaryColor"
                type="color"
                value={form.primaryColor}
                onChange={(e) => setField('primaryColor', e.target.value)}
                className="h-9 w-14 cursor-pointer rounded-md border border-input bg-background p-1"
              />
              <input
                type="text"
                value={form.primaryColor}
                onChange={(e) => setField('primaryColor', e.target.value)}
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="accentColor" className="text-sm font-medium">Accent Color</label>
            <div className="flex items-center gap-2">
              <input
                id="accentColor"
                type="color"
                value={form.accentColor}
                onChange={(e) => setField('accentColor', e.target.value)}
                className="h-9 w-14 cursor-pointer rounded-md border border-input bg-background p-1"
              />
              <input
                type="text"
                value={form.accentColor}
                onChange={(e) => setField('accentColor', e.target.value)}
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Locale Defaults */}
      <div className="rounded-lg border border-border p-6 space-y-4">
        <div>
          <h3 className="font-medium">Locale Defaults</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Default locale settings applied to new tenants and platform-level emails.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="localeDefault" className="text-sm font-medium">Default Locale</label>
            <input
              id="localeDefault"
              type="text"
              value={form.locale.default}
              onChange={(e) => setLocaleField('default', e.target.value)}
              placeholder="ar"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="currencyFormat" className="text-sm font-medium">Currency Format</label>
            <input
              id="currencyFormat"
              type="text"
              value={form.locale.currencyFormat}
              onChange={(e) => setLocaleField('currencyFormat', e.target.value)}
              placeholder="SAR"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="dateFormat" className="text-sm font-medium">Date Format</label>
            <input
              id="dateFormat"
              type="text"
              value={form.locale.dateFormat}
              onChange={(e) => setLocaleField('dateFormat', e.target.value)}
              placeholder="dd/MM/yyyy"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center gap-3 pt-6">
            <input
              id="rtlDefault"
              type="checkbox"
              checked={form.locale.rtlDefault}
              onChange={(e) => setLocaleField('rtlDefault', e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <label htmlFor="rtlDefault" className="text-sm font-medium">RTL by default</label>
          </div>
        </div>
      </div>

      {saveMsg && (
        <div
          className={`rounded-md border p-3 text-sm ${
            saveMsg.ok
              ? 'border-success/30 bg-success/10 text-success'
              : 'border-destructive/30 bg-destructive/10 text-destructive'
          }`}
        >
          {saveMsg.text}
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save branding settings'}
      </button>
    </div>
  );
}
