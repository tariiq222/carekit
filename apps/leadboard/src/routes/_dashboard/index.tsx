import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_dashboard/')({
  component: OverviewPage,
})

function OverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--fg)]">لوحة التحكم</h1>
        <p className="text-sm text-[var(--muted)] mt-1">مرحباً بك في نظام إدارة العيادة</p>
      </div>
      <div className="glass rounded-[var(--radius)] p-8 text-center text-[var(--muted)]">
        <i className="hgi hgi-dashboard-square-01 text-4xl mb-3 block" />
        <p className="text-sm">ستُضاف إحصاءات وتقارير لوحة التحكم في المرحلة القادمة</p>
      </div>
    </div>
  )
}
