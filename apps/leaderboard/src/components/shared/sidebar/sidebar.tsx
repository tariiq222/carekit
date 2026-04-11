import { useState } from 'react'
import { useAuthStore } from '@/lib/stores/auth.store'
import { NAV_GROUPS } from './sidebar-config.js'
import { SidebarNavItem } from './sidebar-nav-item.js'

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { whitelabel, hasFlag } = useAuthStore()

  return (
    <aside
      style={{ width: collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)' }}
      className="fixed inset-y-0 end-0 z-50 flex flex-col bg-[var(--primary)] transition-[width] duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden shadow-[-4px_0_32px_rgba(53,79,216,0.3)]"
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-white/12 min-h-[72px] flex-shrink-0">
        {whitelabel?.logoUrl ? (
          <img
            src={whitelabel.logoUrl}
            alt="logo"
            className="w-9 h-9 rounded-xl object-contain flex-shrink-0 bg-white/18 border border-white/25"
          />
        ) : (
          <div className="w-9 h-9 rounded-xl bg-white/18 border border-white/25 flex items-center justify-center flex-shrink-0">
            <i className="hgi hgi-clinic text-white text-lg" />
          </div>
        )}
        {!collapsed && (
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="text-[15px] font-extrabold text-white tracking-tight truncate">
              {whitelabel?.clinicNameAr ?? 'CareKit'}
            </p>
            <p className="text-[11px] text-white/50 mt-0.5">لوحة التحكم</p>
          </div>
        )}
        {!collapsed ? (
          <button
            onClick={() => setCollapsed(true)}
            className="w-7 h-7 rounded-lg bg-white/12 border border-white/20 flex items-center justify-center text-white/80 hover:bg-white/20 transition-colors"
            aria-label="طي القائمة"
          >
            <i className="hgi hgi-arrow-right-01 text-sm" />
          </button>
        ) : (
          <button
            onClick={() => setCollapsed(false)}
            className="w-7 h-7 rounded-lg bg-white/12 border border-white/20 flex items-center justify-center text-white/80 hover:bg-white/20 transition-colors mx-auto"
            aria-label="توسيع القائمة"
          >
            <i className="hgi hgi-arrow-left-01 text-sm" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2.5 scrollbar-none">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter(
            (item) => item.flag === null || hasFlag(item.flag),
          )
          if (visibleItems.length === 0) return null

          return (
            <div key={group.key} className="mb-1">
              {!collapsed && (
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-[1.2px] px-2.5 pt-2.5 pb-1 whitespace-nowrap">
                  {group.labelAr}
                </p>
              )}
              {visibleItems.map((item) => (
                <SidebarNavItem key={item.key} item={item} collapsed={collapsed} />
              ))}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
