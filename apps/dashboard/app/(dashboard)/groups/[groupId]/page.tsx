"use client"

import { useState } from "react"
import { useParams } from "next/navigation"

import { ListPageShell } from "@/components/features/list-page-shell"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorBanner } from "@/components/features/error-banner"
import { GroupDetailHeader } from "@/components/features/groups/group-detail-header"
import { GroupEnrollmentsTable } from "@/components/features/groups/group-enrollments-table"
import { GroupAttendanceForm } from "@/components/features/groups/group-attendance-form"
import { EnrollPatientGroupDialog } from "@/components/features/groups/enroll-patient-group-dialog"
import { SetGroupDateDialog } from "@/components/features/groups/set-group-date-dialog"
import { useGroupDetail } from "@/hooks/use-groups"
import { useLocale } from "@/components/locale-provider"

export default function GroupDetailPage() {
  const { t, locale } = useLocale()
  const { groupId } = useParams<{ groupId: string }>()
  const { data: group, isLoading, error } = useGroupDetail(groupId)
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

  if (error || !group) {
    return (
      <ListPageShell>
        <ErrorBanner message={error instanceof Error ? error.message : t("common.error")} />
      </ListPageShell>
    )
  }

  const name = locale === "ar" ? group.nameAr : group.nameEn
  const canShowAttendance = group.status === "confirmed" || group.status === "full"

  return (
    <ListPageShell>
      <Breadcrumbs items={[
        { label: t("groups.title"), href: "/services?tab=groups" },
        { label: name },
      ]} />

      <GroupDetailHeader
        group={group}
        onEnrollClick={() => setEnrollOpen(true)}
        onSetDateClick={() => setDateOpen(true)}
      />

      <GroupEnrollmentsTable
        enrollments={group.enrollments ?? []}
        groupId={groupId}
      />

      {canShowAttendance && (
        <GroupAttendanceForm
          group={group}
          enrollments={group.enrollments ?? []}
        />
      )}

      <EnrollPatientGroupDialog
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        groupId={groupId}
      />

      {group.schedulingMode === "on_capacity" && (
        <SetGroupDateDialog
          open={dateOpen}
          onClose={() => setDateOpen(false)}
          groupId={groupId}
        />
      )}
    </ListPageShell>
  )
}
