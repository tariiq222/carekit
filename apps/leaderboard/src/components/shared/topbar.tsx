import { useAuthStore } from '@/lib/stores/auth.store'
import { useLogout } from '@/hooks/use-auth'

export function Topbar() {
  const { user } = useAuthStore()
  const logout = useLogout()

  return (
    <header
      style={{ height: 'var(--topbar-h)' }}
      className="glass-solid fixed top-0 start-0 end-[var(--sidebar-w)] z-40 flex items-center justify-between px-6 border-b border-[var(--border-soft)]"
    >
      <div />
      <div className="flex items-center gap-3">
        <span className="text-sm text-[var(--fg-2)]">{user?.name}</span>
        <button
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="h-8 px-3 rounded-[var(--radius-sm)] text-xs font-medium text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--border-soft)] transition-colors"
        >
          <i className="hgi hgi-logout-01" />
        </button>
      </div>
    </header>
  )
}
