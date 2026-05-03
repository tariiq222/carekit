import type { ReactNode } from 'react';
import Link from 'next/link';

const TABS = [
  { href: '/settings/email', label: 'Email' },
  { href: '/settings/notifications', label: 'Notifications' },
  { href: '/settings/billing', label: 'Billing' },
  { href: '/settings/branding', label: 'Branding' },
  { href: '/settings/health', label: 'System Health' },
  { href: '/settings/security', label: 'Security' },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <nav className="mb-6 flex gap-2 border-b border-border pb-2">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
