'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@carekit/ui/lib/cn';

const ITEMS: Array<{ href: string; labelKey: string }> = [
  { href: '/', labelKey: 'nav.overview' },
  { href: '/organizations', labelKey: 'nav.organizations' },
  { href: '/users', labelKey: 'nav.users' },
  { href: '/plans', labelKey: 'nav.plans' },
  { href: '/verticals', labelKey: 'nav.verticals' },
  { href: '/billing', labelKey: 'nav.billing' },
  { href: '/metrics', labelKey: 'nav.metrics' },
  { href: '/audit-log', labelKey: 'nav.auditLog' },
  { href: '/impersonation-sessions', labelKey: 'nav.impersonation' },
];

export function Sidebar() {
  const pathname = usePathname();
  const t = useTranslations();
  return (
    <nav className="flex flex-col gap-1">
      {ITEMS.map((item) => {
        const active =
          item.href === '/'
            ? pathname === '/'
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-md px-3 py-2 text-sm transition',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
