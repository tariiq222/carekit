'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listTemplates, PlatformEmailTemplateListItem } from '@/features/platform-email/platform-email.api';
import { ApiError } from '@/lib/api-client';

export default function EmailTemplatesListPage() {
  const [templates, setTemplates] = useState<PlatformEmailTemplateListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTemplates()
      .then(setTemplates)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load templates'))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-destructive/10 border border-destructive/30 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center">
        <p className="text-muted-foreground text-sm">No platform email templates found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Platform Email Templates</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {templates.length} template{templates.length !== 1 ? 's' : ''} registered.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <Link
            key={t.id}
            href={`/settings/email/templates/${t.slug}`}
            className="rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">{t.slug}</span>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  t.isActive
                    ? 'bg-success/10 text-success border border-success/30'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {t.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-sm font-medium">{t.name}</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>v{t.version}</span>
              {t.isLocked && (
                <span className="rounded bg-muted px-1.5 py-0.5">Locked</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
