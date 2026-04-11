import { createFileRoute } from '@tanstack/react-router'
import { OverviewStats } from '@/components/features/overview/overview-stats'
import { GreetingBanner } from '@/components/features/overview/greeting-banner'
import { OverviewTimeline } from '@/components/features/overview/overview-timeline'
import { QuickActions } from '@/components/features/overview/quick-actions'
import { OverviewAlerts } from '@/components/features/overview/overview-alerts'

export const Route = createFileRoute('/_dashboard/')({
  component: OverviewPage,
})

function OverviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <GreetingBanner />

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
