'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@carekit/ui/lib/cn';

const ITEMS: Array<{ href: string; label: string }> = [
  { href: '/', label: 'Overview' },
  { href: '/organizations', label: 'Organizations' },
  { href: '/users', label: 'Users' },
  { href: '/plans', label: 'Plans' },
  { href: '/verticals', label: 'Verticals' },
  { href: '/metrics', label: 'Metrics' },
  { href: '/audit-log', label: 'Audit log' },
  { href: '/impersonation-sessions', label: 'Impersonation sessions' },
];

export function Sidebar() {
  const pathname = usePathname();
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
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
