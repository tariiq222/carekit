'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@deqah/ui/primitives/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@deqah/ui/primitives/card';
import { Label } from '@deqah/ui/primitives/label';
import { Skeleton } from '@deqah/ui/primitives/skeleton';
import { Switch } from '@deqah/ui/primitives/switch';
import { Textarea } from '@deqah/ui/primitives/textarea';
import type { EntitlementRow } from './list-entitlements.api';
import { useEntitlements, useUpdateEntitlement } from './use-entitlements';

interface Props {
  organizationId: string;
}

export function EntitlementsPanel({ organizationId }: Props) {
  const t = useTranslations('organizations.entitlements');
  const locale = useLocale();
  const { data, isLoading } = useEntitlements(organizationId);
  const mutation = useUpdateEntitlement(organizationId);
  const [reason, setReason] = useState('');
  const canMutate = reason.trim().length >= 10 && !mutation.isPending;

  const toggle = (row: EntitlementRow, enabled: boolean) => {
    if (!canMutate) return;
    mutation.mutate({ key: row.key, enabled, reason: reason.trim() });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="entitlement-reason">{t('reason')}</Label>
          <Textarea
            id="entitlement-reason"
            rows={2}
            value={reason}
            placeholder={t('reasonPlaceholder')}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16" />
            ))}
          </div>
        ) : null}

        {!isLoading && data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        ) : null}

        <div className="space-y-3">
          {(data ?? []).map((row) => (
            <div
              key={row.key}
              className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-border bg-card/50 p-4"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <div className="font-medium">{locale === 'ar' ? row.nameAr : row.nameEn}</div>
                  <div className="font-mono text-xs text-muted-foreground">{row.key}</div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <StateBadge
                    label={t('plan')}
                    enabled={row.planDerivedEnabled}
                    enabledLabel={t('enabled')}
                    disabledLabel={t('disabled')}
                  />
                  <StateBadge
                    label={t('override')}
                    enabled={row.overrideEnabled}
                    emptyLabel={t('none')}
                    enabledLabel={t('enabled')}
                    disabledLabel={t('disabled')}
                  />
                  <StateBadge
                    label={t('final')}
                    enabled={row.enabled}
                    enabledLabel={t('enabled')}
                    disabledLabel={t('disabled')}
                  />
                  <Badge variant="outline" className="border-border bg-muted/10">
                    {t('source')}: {row.source}
                  </Badge>
                </div>
                {row.overrideUpdatedAt ? (
                  <div className="text-xs text-muted-foreground">
                    {t('updated', { date: new Date(row.overrideUpdatedAt).toLocaleString() })}
                  </div>
                ) : null}
              </div>

              <Switch
                aria-label={t('toggleLabel', { key: row.key })}
                checked={row.enabled}
                disabled={!canMutate}
                onCheckedChange={(checked) => toggle(row, checked)}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function StateBadge({
  label,
  enabled,
  enabledLabel,
  disabledLabel,
  emptyLabel,
}: {
  label: string;
  enabled: boolean | null;
  enabledLabel: string;
  disabledLabel: string;
  emptyLabel?: string;
}) {
  if (enabled === null) {
    return (
      <Badge variant="outline" className="border-border bg-muted/10 text-muted-foreground">
        {label}: {emptyLabel}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={
        enabled
          ? 'border-success/40 bg-success/10 text-success'
          : 'border-muted bg-muted text-muted-foreground'
      }
    >
      {label}: {enabled ? enabledLabel : disabledLabel}
    </Badge>
  );
}
