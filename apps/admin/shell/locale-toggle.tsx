'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { cn } from '@deqah/ui/lib/cn';
import { LOCALE_COOKIE, type Locale } from '@/lib/locale';

const SEGMENTS: { value: Locale; label: string }[] = [
  { value: 'ar', label: 'ع' },
  { value: 'en', label: 'EN' },
];

function readCurrentLocale(): Locale {
  const match = document.cookie.match(/(?:^|;\s*)admin\.locale=([^;]+)/);
  const val = match?.[1];
  if (val === 'ar' || val === 'en') return val;
  return 'ar';
}

function writeCookie(locale: Locale) {
  const secureFlag = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; SameSite=Lax${secureFlag}`;
}

export function LocaleToggle() {
  const [active, setActive] = useState<Locale>(() =>
    typeof document === 'undefined' ? 'ar' : readCurrentLocale(),
  );
  const t = useTranslations('locale');
  const router = useRouter();

  function select(locale: Locale) {
    if (locale === active) return;
    writeCookie(locale);
    setActive(locale);
    router.refresh();
  }

  return (
    <div
      role="group"
      aria-label={t('toggle')}
      className="flex h-7 items-center gap-0.5 rounded-md border border-border bg-surface-muted p-0.5"
    >
      {SEGMENTS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          aria-label={t(value)}
          aria-pressed={active === value}
          onClick={() => select(value)}
          className={cn(
            'flex h-6 min-w-7 items-center justify-center rounded-sm px-1.5 text-[11px] font-medium transition-colors',
            active === value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
