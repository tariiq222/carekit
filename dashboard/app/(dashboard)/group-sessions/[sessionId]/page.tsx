"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useGroupSessionDetail } from "@/hooks/use-group-sessions"
import { useLocale } from "@/components/locale-provider"
import { ListPageShell } from "@/components/features/list-page-shell"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { SessionDetailHeader } from "@/components/features/group-sessions/session-detail-header"
import { EnrollmentsTable } from "@/components/features/group-sessions/enrollments-table"
import { AttendanceForm } from "@/components/features/group-sessions/attendance-form"
import { EnrollPatientDialog } from "@/components/features/group-sessions/enroll-patient-dialog"
import { Skeleton } from "@/components/ui/skeleton"

export default function SessionDetailPage() {
  const { t } = useLocale()
  const params = useParams<{ sessionId: string }>()
  const { data: session, isLoading } = useGroupSessionDetail(params.sessionId)
  const [enrollOpen, setEnrollOpen] = useState(false)

  if (isLoading) {
    return (
      <ListPageShell>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[200px]" />
        <Skeleton className="h-[300px]" />
      </ListPageShell>
    )
  }

  if (!session) return null

  const offeringName = session.groupOffering?.nameAr ?? ""

  return (
    <ListPageShell>
      <Breadcrumbs
        items={[
          { label: t("groupSessions.title"), href: "/group-sessions" },
          { label: offeringName },
        ]}
      />

      <SessionDetailHeader session={session} onEnrollClick={() => setEnrollOpen(true)} />

      <EnrollmentsTable enrollments={session.enrollments ?? []} sessionId={session.id} />

      {(session.status === "confirmed" || session.status === "full") && (
        <AttendanceForm session={session} />
      )}

      <EnrollPatientDialog
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        sessionId={session.id}
      />
    </ListPageShell>
  )
}
