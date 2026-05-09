'use client';

import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@deqah/ui/primitives/button';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { ThemeToggle } from '@/shell/theme-toggle';

function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label="Sign out"
      onClick={() => {
        window.localStorage.removeItem('admin.accessToken');
        const secureFlag =
          typeof window !== 'undefined' && window.location.protocol === 'https:'
            ? '; Secure'
            : '';
        document.cookie = `admin.authenticated=; path=/; SameSite=Strict${secureFlag}; Max-Age=0`;
        router.push('/login');
      }}
      className="h-7 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
    >
      <LogOut size={14} strokeWidth={1.75} aria-hidden />
      <span className="text-xs">Sign out</span>
    </Button>
  );
}

export function Topbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center border-b border-border bg-background/80 px-6 backdrop-blur-sm">
      <div className="flex-1">
        <Breadcrumbs pathname={pathname} />
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <SignOutButton />
      </div>
    </header>
  );
}
