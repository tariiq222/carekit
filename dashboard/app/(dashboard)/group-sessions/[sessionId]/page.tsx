"use client"

import { useState } from "react"
import { useParams } from "next/navigation"

import { ListPageShell } from "@/components/features/list-page-shell"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorBanner } from "@/components/features/error-banner"
import { SessionDetailHeader } from "@/components/features/group-sessions/session-detail-header"
import { EnrollmentsTable } from "@/components/features/group-sessions/enrollments-table"
import { AttendanceForm } from "@/components/features/group-sessions/attendance-form"
import { EnrollPatientDialog } from "@/components/features/group-sessions/enroll-patient-dialog"
import { SetDateDialog } from "@/components/features/group-sessions/set-date-dialog"
import { useGroupSessionDetail } from "@/hooks/use-group-sessions"
import { useLocale } from "@/components/locale-provider"

export default function GroupSessionDetailPage() {
  const { t, locale } = useLocale()
  const { sessionId } = useParams<{ sessionId: string }>()
  const { data: session, isLoading, error } = useGroupSessionDetail(sessionId)
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [dateOpen, setDateOpen] = useState(false)

  if (isLoading) {
    return (
      <ListPageShell>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </ListPageShell>
    )
  }

  if (error || !session) {
    return (
      <ListPageShell>
        <ErrorBanner message={error instanceof Error ? error.message : t("common.error")} />
      </ListPageShell>
    )
  }

  const name = locale === "ar" ? session.nameAr : session.nameEn
  const canShowAttendance = session.status === "confirmed" || session.status === "full"

  return (
    <ListPageShell>
      <Breadcrumbs items={[
        { label: t("groupSessions.title"), href: "/services?tab=group-sessions" },
        { label: name },
      ]} />

      <SessionDetailHeader
        session={session}
        onEnrollClick={() => setEnrollOpen(true)}
        onSetDateClick={() => setDateOpen(true)}
      />

      <EnrollmentsTable
        enrollments={session.enrollments ?? []}
        sessionId={session.id}
      />

      {canShowAttendance && <AttendanceForm session={session} />}

      <EnrollPatientDialog
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        sessionId={session.id}
      />

      <SetDateDialog
        open={dateOpen}
        onOpenChange={setDateOpen}
        sessionId={session.id}
      />
    </ListPageShell>
  )
}
