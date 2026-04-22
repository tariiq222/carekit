import type { ReactNode } from 'react';
import { Sidebar } from '@/components/sidebar';
import { LogoutButton } from '@/components/logout-button';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-border bg-card px-4 py-6">
        <div className="mb-6 px-2">
          <h1 className="text-lg font-semibold">CareKit Admin</h1>
          <p className="text-xs text-muted-foreground">Platform control plane</p>
        </div>
        <Sidebar />
        <div className="mt-8 border-t border-border px-2 pt-4">
          <LogoutButton />
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
