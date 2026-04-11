import { Link, useRouterState } from '@tanstack/react-router'
import type { NavItem } from './sidebar-config.js'
import { HIcon } from '@/components/shared/hicon'

interface Props {
  item: NavItem
  collapsed: boolean
}

export function SidebarNavItem({ item, collapsed }: Props) {
  const matches = useRouterState({ select: (s) => s.location.pathname })
  const isActive = matches === item.path || (item.path !== '/' && matches.startsWith(item.path))

  return (
    <Link
      to={item.path}
      title={collapsed ? item.labelAr : undefined}
      className={[
        'flex items-center rounded-[var(--radius-sm)]',
        'text-sm font-medium transition-all duration-150 cursor-pointer select-none',
        'whitespace-nowrap overflow-hidden',
        collapsed ? 'justify-center w-10 h-10 mx-auto' : 'gap-2.5 px-2.5 py-2',
        isActive
          ? 'bg-white/20 text-white shadow-sm'
          : 'text-white/65 hover:bg-white/12 hover:text-white',
      ].join(' ')}
    >
      <HIcon name={item.icon} size={18} className="flex-shrink-0" />
      {!collapsed && <span className="truncate">{item.labelAr}</span>}
    </Link>
  )
}
