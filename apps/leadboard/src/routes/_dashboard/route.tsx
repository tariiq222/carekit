import { createFileRoute, Outlet } from '@tanstack/react-router'
import { AuthGuard } from '@/lib/guards/auth-guard'
import { Sidebar } from '@/components/shared/sidebar/sidebar'
import { Topbar } from '@/components/shared/topbar'

export const Route = createFileRoute('/_dashboard')({
  component: DashboardShell,
})

function DashboardShell() {
  return (
    <AuthGuard>
      <div className="relative z-10 min-h-screen">
        <Sidebar />
        <Topbar />
        <main
          style={{
            paddingInlineEnd: 'var(--sidebar-w)',
            paddingTop: 'var(--topbar-h)',
          }}
          className="min-h-screen transition-[padding] duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
        >
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </AuthGuard>
  )
}
