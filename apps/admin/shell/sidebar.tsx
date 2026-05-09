'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Users,
  Eye,
  Receipt,
  Layers,
  Tags,
  Bell,
  Settings,
  LineChart,
  ScrollText,
} from 'lucide-react';
import { cn } from '@deqah/ui/lib/cn';

interface NavChild {
  href: string;
  label: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  hint?: string;
  children?: NavChild[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV: NavSection[] = [
  {
    title: 'Operate',
    items: [
      { href: '/', label: 'Overview', icon: LayoutDashboard, hint: 'g o' },
      { href: '/organizations', label: 'Organizations', icon: Building2, hint: 'g r' },
      { href: '/users', label: 'Users', icon: Users, hint: 'g u' },
      { href: '/impersonation-sessions', label: 'Impersonation', icon: Eye },
    ],
  },
  {
    title: 'Money',
    items: [
      {
        href: '/billing',
        label: 'Billing',
        icon: Receipt,
        children: [{ href: '/billing/zoho', label: 'Zoho schedule' }],
      },
      { href: '/plans', label: 'Plans', icon: Layers },
    ],
  },
  {
    title: 'Configure',
    items: [
      { href: '/verticals', label: 'Verticals', icon: Tags },
      { href: '/notifications', label: 'Notifications', icon: Bell },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
  {
    title: 'Inspect',
    items: [
      { href: '/metrics', label: 'Metrics', icon: LineChart },
      { href: '/audit-log', label: 'Audit log', icon: ScrollText },
    ],
  },
];

function isActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  href,
  label,
  icon: Icon,
  hint,
  active,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  hint?: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'relative flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] transition-colors',
        active
          ? 'bg-surface-muted text-foreground'
          : 'text-muted-foreground hover:bg-surface-muted/60 hover:text-foreground',
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute inset-y-1 start-0 w-0.5 rounded-full bg-primary"
        />
      )}
      <Icon size={14} strokeWidth={1.75} aria-hidden className="shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {hint && (
        <span className="hidden shrink-0 font-mono text-[10px] tracking-widest text-muted-foreground/50 sm:block">
          {hint}
        </span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation">
      {NAV.map((section, sectionIdx) => (
        <div key={section.title} className={cn('flex flex-col gap-0.5', sectionIdx > 0 && 'mt-4')}>
          <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/70">
            {section.title}
          </p>
          {section.items.map((item) => {
            const parentActive = isActive(item.href, pathname);
            return (
              <div key={item.href} className="flex flex-col gap-0.5">
                <NavLink
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  hint={item.hint}
                  active={parentActive}
                />
                {item.children && parentActive
                  ? item.children.map((child) => {
                      const childActive = isActive(child.href, pathname);
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            'ms-6 rounded-md px-3 py-1 text-[12px] transition-colors',
                            childActive
                              ? 'text-foreground'
                              : 'text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {child.label}
                        </Link>
                      );
                    })
                  : null}
              </div>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
