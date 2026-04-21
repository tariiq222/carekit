"use client"

import {
  MessageMultiple02Icon,
  TimeQuarterPassIcon,
  ArrowTurnForwardIcon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"

import { StatCard } from "@/components/features/stat-card"
import { Card, CardContent, CardHeader, CardTitle } from "@carekit/ui"
import { Skeleton } from "@carekit/ui"
import { useLocale } from "@/components/locale-provider"
import { useChatbotAnalytics, useTopQuestions } from "@/hooks/use-chatbot"

/* ─── Helpers ─── */

function formatAvgDuration(avgMessages: number): string {
  // Estimate ~2 min per message exchange
  const mins = Math.round(avgMessages * 2)
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

/* ─── Component ─── */

export function AnalyticsTab() {
  const { t } = useLocale()
  const { stats, loading: statsLoading } = useChatbotAnalytics()
  const { questions, loading: questionsLoading } = useTopQuestions(10)

  if (statsLoading) {
    return (
      <div className="flex flex-col gap-6 pt-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 pt-4">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t("chatbot.analytics.totalSessions")}
          value={stats?.totalSessions ?? 0}
          icon={MessageMultiple02Icon}
          iconColor="primary"
        />
        <StatCard
          title={t("chatbot.analytics.activeSessions")}
          value={stats?.totalMessages ?? 0}
          description={t("chatbot.analytics.totalMessages")}
          icon={UserMultiple02Icon}
          iconColor="success"
        />
        <StatCard
          title={t("chatbot.analytics.avgDuration")}
          value={formatAvgDuration(stats?.avgMessagesPerSession ?? 0)}
          description={`${stats?.avgMessagesPerSession?.toFixed(1) ?? 0} msgs/session`}
          icon={TimeQuarterPassIcon}
          iconColor="warning"
        />
        <StatCard
          title={t("chatbot.analytics.handoffRate")}
          value={`${((stats?.handoffRate ?? 0) * 100).toFixed(1)}%`}
          icon={ArrowTurnForwardIcon}
          iconColor="accent"
        />
      </div>

      {/* Top Questions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            {t("chatbot.analytics.topQuestions")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {questionsLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : !Array.isArray(questions) || questions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("chatbot.analytics.noQuestions")}
            </p>
          ) : (
            <ol className="flex flex-col gap-0">
              {questions.map((q, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between border-b py-2.5 last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary tabular-nums">
                      {i + 1}
                    </span>
                    <span className="text-sm text-foreground line-clamp-1">
                      {q.content}
                    </span>
                  </div>
                  <span className="ms-4 shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
                    {q.count}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
