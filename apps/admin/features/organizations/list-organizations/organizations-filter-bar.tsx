'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@carekit/ui/primitives/button';
import { Input } from '@carekit/ui/primitives/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@carekit/ui/primitives/select';
import type { OrganizationStatus } from '../types';

export type SuspendedFilter = 'all' | 'true' | 'false';
export type LifecycleStatusFilter = 'all' | OrganizationStatus;

interface Props {
  search: string;
  onSearchChange: (next: string) => void;
  suspended: SuspendedFilter;
  onSuspendedChange: (next: SuspendedFilter) => void;
  status: LifecycleStatusFilter;
  onStatusChange: (next: LifecycleStatusFilter) => void;
  verticalId: string;
  onVerticalIdChange: (next: string) => void;
  planId: string;
  onPlanIdChange: (next: string) => void;
  onReset: () => void;
}

export function OrganizationsFilterBar({
  search,
  onSearchChange,
  suspended,
  onSuspendedChange,
  status,
  onStatusChange,
  verticalId,
  onVerticalIdChange,
  planId,
  onPlanIdChange,
  onReset,
}: Props) {
  const t = useTranslations('organizations.filters');
  const statusT = useTranslations('organizations.status');

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/50 px-4 py-3">
      <Input
        placeholder={t('search')}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="max-w-sm"
      />
      <Select value={suspended} onValueChange={(v) => onSuspendedChange(v as SuspendedFilter)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder={t('suspended')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('suspendedAll')}</SelectItem>
          <SelectItem value="false">{t('activeOnly')}</SelectItem>
          <SelectItem value="true">{t('suspendedOnly')}</SelectItem>
        </SelectContent>
      </Select>
      <Select value={status} onValueChange={(v) => onStatusChange(v as LifecycleStatusFilter)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder={t('status')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('statusAll')}</SelectItem>
          <SelectItem value="TRIALING">{statusT('TRIALING')}</SelectItem>
          <SelectItem value="ACTIVE">{statusT('ACTIVE')}</SelectItem>
          <SelectItem value="PAST_DUE">{statusT('PAST_DUE')}</SelectItem>
          <SelectItem value="SUSPENDED">{statusT('SUSPENDED')}</SelectItem>
          <SelectItem value="ARCHIVED">{statusT('ARCHIVED')}</SelectItem>
        </SelectContent>
      </Select>
      <Input
        placeholder={t('verticalId')}
        value={verticalId}
        onChange={(e) => onVerticalIdChange(e.target.value)}
        className="max-w-[180px]"
      />
      <Input
        placeholder={t('planId')}
        value={planId}
        onChange={(e) => onPlanIdChange(e.target.value)}
        className="max-w-[180px]"
      />
      <Button variant="ghost" size="sm" onClick={onReset}>
        {t('reset')}
      </Button>
    </div>
  );
}
