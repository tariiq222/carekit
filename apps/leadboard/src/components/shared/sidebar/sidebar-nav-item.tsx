import { Link, useRouterState } from '@tanstack/react-router'
import type { NavItem } from './sidebar-config.js'

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
        'flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--radius-sm)]',
        'text-sm font-medium transition-all duration-150 cursor-pointer select-none',
        'whitespace-nowrap overflow-hidden',
        isActive
          ? 'bg-white/20 text-white shadow-sm'
          : 'text-white/65 hover:bg-white/12 hover:text-white',
      ].join(' ')}
    >
      <i className={`hgi ${item.icon} flex-shrink-0 text-base`} />
      {!collapsed && <span className="truncate">{item.labelAr}</span>}
    </Link>
  )
}
