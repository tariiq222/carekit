import { useState } from 'react'
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { AuthGuard } from '@/lib/guards/auth-guard'
import { Sidebar } from '@/components/shared/sidebar/sidebar'
import { Topbar } from '@/components/shared/topbar'
import { TooltipProvider } from '@/components/ui/tooltip'

export const Route = createFileRoute('/_dashboard')({
  component: DashboardShell,
})

function DashboardShell() {
  const [collapsed, setCollapsed] = useState(false)
  const [wide, setWide] = useState(false)

  return (
    <AuthGuard>
      <TooltipProvider>
        {/* Animated background — blobs + mesh gradient */}
        <div className="bg-scene">
          <div className="bg-mesh" />
          <div className="blob blob-1" />
          <div className="blob blob-2" />
          <div className="blob blob-3" />
        </div>

        <div className="relative z-10 min-h-screen">
          <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
          <Topbar
            collapsed={collapsed}
            onToggleSidebar={() => setCollapsed((v) => !v)}
            wide={wide}
            onToggleWide={() => setWide((v) => !v)}
          />
          <main
            style={{
              paddingInlineStart: collapsed
                ? 'var(--sidebar-w-collapsed)'
                : 'var(--sidebar-w)',
              paddingTop: 'var(--topbar-h)',
            }}
            className="min-h-screen transition-[padding] duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
          >
            <div className={wide ? 'p-6' : 'p-6 max-w-[1440px] mx-auto'}>
              <Outlet />
            </div>
          </main>
        </div>
      </TooltipProvider>
    </AuthGuard>
  )
}
