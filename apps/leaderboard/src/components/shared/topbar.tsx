import { useState } from 'react'
import { useAuthStore } from '@/lib/stores/auth.store'
import { HIcon } from '@/components/shared/hicon'
import { CommandPalette } from './command-palette'

interface TopbarProps {
  collapsed: boolean
  onToggleSidebar: () => void
  wide: boolean
  onToggleWide: () => void
}

export function Topbar({ collapsed, onToggleSidebar, wide, onToggleWide }: TopbarProps) {
  const { user } = useAuthStore()
  const [cmdOpen, setCmdOpen] = useState(false)

  const initials = user?.name
    ? user.name
        .split(' ')
        .slice(0, 2)
        .map((w: string) => w[0])
        .join('')
    : 'م'

  return (
    <>
      <header
        className="topbar fixed top-0 left-0 z-40 transition-[right] duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{
          height: 'var(--topbar-h)',
          right: collapsed
            ? 'var(--sidebar-w-collapsed)'
            : 'var(--sidebar-w)',
        }}
      >
        <div className="topbar-inner">
          {/* Start group: sidebar toggle + command palette */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Sidebar toggle */}
            <button
              className="tb-btn"
              onClick={onToggleSidebar}
              aria-label="طي القائمة"
            >
              <HIcon name="hgi-menu-01" />
            </button>

            {/* Command Palette Pill */}
            <button
              className="cmd-pill"
              onClick={() => setCmdOpen(true)}
              aria-label="بحث سريع — ⌘K"
            >
              <HIcon name="hgi-search-01" />
              <span className="cmd-pill-text">بحث سريع...</span>
              <kbd className="cmd-kbd" aria-hidden="true">⌘K</kbd>
            </button>
          </div>

          {/* End group: notifications + wide toggle + avatar */}
          <div className="topbar-right">
            {/* Notifications */}
            <button className="tb-btn" aria-label="الإشعارات">
              <HIcon name="hgi-notification-02" />
              <span className="tb-dot" aria-hidden="true" />
            </button>

            {/* Wide / maximize toggle */}
            <button
              className="tb-btn"
              onClick={onToggleWide}
              aria-label={wide ? 'عرض عادي' : 'توسيع المحتوى'}
            >
              <HIcon name={wide ? 'hgi-expand' : 'hgi-fullscreen'} />
            </button>

            {/* Avatar */}
            <div
              className="tb-av"
              title={user?.name ?? 'المستخدم'}
              aria-label={user?.name ?? 'المستخدم'}
            >
              {initials}
            </div>
          </div>
        </div>
      </header>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </>
  )
}
