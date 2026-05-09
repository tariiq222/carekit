'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@deqah/ui/primitives/button';
import { Input } from '@deqah/ui/primitives/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@deqah/ui/primitives/select';
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
    <div className="flex flex-wrap items-center gap-2 border-y border-border py-2">
      <Input
        placeholder="org_…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="mono h-8 max-w-[200px] text-xs placeholder:text-muted-foreground/60"
      />
      <Select value={suspended} onValueChange={(v) => onSuspendedChange(v as SuspendedFilter)}>
        <SelectTrigger className="h-8 w-[150px] text-xs">
          <SelectValue placeholder={t('suspended')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('suspendedAll')}</SelectItem>
          <SelectItem value="false">{t('activeOnly')}</SelectItem>
          <SelectItem value="true">{t('suspendedOnly')}</SelectItem>
        </SelectContent>
      </Select>
      <Select value={status} onValueChange={(v) => onStatusChange(v as LifecycleStatusFilter)}>
        <SelectTrigger className="h-8 w-[150px] text-xs">
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
        placeholder="vertical_id…"
        value={verticalId}
        onChange={(e) => onVerticalIdChange(e.target.value)}
        className="mono h-8 w-[160px] text-xs placeholder:text-muted-foreground/60"
      />
      <Input
        placeholder="plan_id…"
        value={planId}
        onChange={(e) => onPlanIdChange(e.target.value)}
        className="mono h-8 w-[140px] text-xs placeholder:text-muted-foreground/60"
      />
      <Button
        variant="ghost"
        size="sm"
        className="h-8 text-xs text-muted-foreground hover:text-foreground"
        onClick={onReset}
      >
        {t('reset')}
      </Button>
    </div>
  );
}
