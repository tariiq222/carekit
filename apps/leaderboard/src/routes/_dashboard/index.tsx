import { createFileRoute } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/stores/auth.store'
import { OverviewStats } from '@/components/features/overview/overview-stats'
import { OverviewTimeline } from '@/components/features/overview/overview-timeline'
import { QuickActions } from '@/components/features/overview/quick-actions'
import { OverviewAlerts } from '@/components/features/overview/overview-alerts'

export const Route = createFileRoute('/_dashboard/')({
  component: OverviewPage,
})

function OverviewPage() {
  const user = useAuthStore((s) => s.user)
  const whitelabel = useAuthStore((s) => s.whitelabel)
  const clinicName = whitelabel?.clinicNameAr || whitelabel?.clinicName

  const displayName = user?.nameAr || user?.name
  const greeting = displayName ? `أهلاً، ${displayName}` : 'أهلاً بك'

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-[var(--fg)]">{greeting}</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          {clinicName ? `نظرة عامة على ${clinicName}` : 'نظرة عامة على عيادتك'}
        </p>
      </header>

      <OverviewStats />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <OverviewTimeline />
        </div>
        <div className="flex flex-col gap-6">
          <QuickActions />
          <OverviewAlerts />
        </div>
      </div>
    </div>
  )
}
