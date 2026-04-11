import { createFileRoute } from '@tanstack/react-router'
import { useChatbotConfig, useChatbotAnalytics, useChatbotTopQuestions } from '@/hooks/use-chatbot-admin'
import { PageHeader } from '@/components/shared/page-header'
import { StatsGrid } from '@/components/shared/stats-grid'

export const Route = createFileRoute('/_dashboard/chatbot/')({
  component: ChatbotAdminPage,
})

function ChatbotAdminPage() {
  const configQuery = useChatbotConfig()
  const analyticsQuery = useChatbotAnalytics()
  const questionsQuery = useChatbotTopQuestions()

  const analytics = analyticsQuery.data

  const statCards = [
    {
      label: 'إجمالي الجلسات',
      value: analytics?.totalSessions ?? 0,
      icon: 'hgi-bot',
      variant: 'primary' as const,
    },
    {
      label: 'جلسات نشطة',
      value: analytics?.activeSessions ?? 0,
      icon: 'hgi-layers-01',
      variant: 'success' as const,
    },
    {
      label: 'متوسط الرسائل',
      value: analytics?.avgMessagesPerSession ?? 0,
      icon: 'hgi-mail-01',
      variant: 'warning' as const,
    },
    {
      label: 'رضا المستخدمين',
      value: analytics ? `${(analytics.satisfactionRate * 100).toFixed(0)}%` : '—',
      icon: 'hgi-star',
      variant: 'accent' as const,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="إعدادات الشاتبوت"
        description="مراقبة وتهيئة نظام الشاتبوت الذكي"
      />

      <StatsGrid stats={statCards} loading={analyticsQuery.isLoading} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="glass rounded-[var(--radius)] p-5">
          <h2 className="text-base font-bold text-[var(--fg)] mb-4">إعدادات التهيئة</h2>
          {configQuery.isLoading ? (
            <div className="h-32 animate-pulse bg-[var(--surface)] rounded-[var(--radius-sm)]" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-soft)]">
                    <th className="text-start py-2 px-3 text-[var(--muted)] font-medium">الفئة</th>
                    <th className="text-start py-2 px-3 text-[var(--muted)] font-medium">المفتاح</th>
                    <th className="text-start py-2 px-3 text-[var(--muted)] font-medium">القيمة</th>
                  </tr>
                </thead>
                <tbody>
                  {(configQuery.data ?? []).map((c) => (
                    <tr key={`${c.category}:${c.key}`} className="border-b border-[var(--border-soft)] last:border-b-0">
                      <td className="py-2 px-3 text-[var(--fg-2)]">{c.category}</td>
                      <td className="py-2 px-3 font-mono text-xs text-[var(--fg-2)]">{c.key}</td>
                      <td className="py-2 px-3 text-[var(--fg)]">{c.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="glass rounded-[var(--radius)] p-5">
          <h2 className="text-base font-bold text-[var(--fg)] mb-4">الأسئلة الأكثر شيوعاً</h2>
          {questionsQuery.isLoading ? (
            <div className="h-32 animate-pulse bg-[var(--surface)] rounded-[var(--radius-sm)]" />
          ) : (questionsQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-[var(--muted)] text-center py-6">لا توجد بيانات بعد</p>
          ) : (
            <ol className="space-y-2">
              {(questionsQuery.data ?? []).slice(0, 10).map((q, i) => (
                <li
                  key={q.question}
                  className="flex items-center gap-3 py-2 border-b border-[var(--border-soft)] last:border-b-0"
                >
                  <span className="text-xs font-bold text-[var(--muted)] w-5 shrink-0">{i + 1}</span>
                  <span className="flex-1 text-sm text-[var(--fg)]">{q.question}</span>
                  <span className="text-xs font-medium text-[var(--primary)] bg-[var(--primary-ultra)] px-2 py-0.5 rounded-full">
                    {q.count}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}
