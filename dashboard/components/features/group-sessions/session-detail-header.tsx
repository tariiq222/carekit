"use client"

import { useLocale } from "@/components/locale-provider"
import { useGroupSessionsMutations } from "@/hooks/use-group-sessions-mutations"
import { PageHeader } from "@/components/features/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import type { GroupSession } from "@/lib/types/group-sessions"

const statusStyles: Record<string, string> = {
  open: "bg-primary/10 text-primary border-primary/30",
  confirmed: "bg-success/10 text-success border-success/30",
  full: "bg-warning/10 text-warning border-warning/30",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
}

interface Props {
  session: GroupSession
  onEnrollClick: () => void
}

export function SessionDetailHeader({ session, onEnrollClick }: Props) {
  const { t, locale } = useLocale()
  const { cancelSessionMut } = useGroupSessionsMutations()

  const offering = session.groupOffering
  const name = locale === "ar" ? offering?.nameAr : offering?.nameEn
  const practitioner = offering?.practitioner?.nameAr ?? ""
  const date = new Date(session.startTime).toLocaleDateString(
    locale === "ar" ? "ar-SA" : "en-US",
    { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
  )

  const enrollments = session.enrollments ?? []
  const confirmed = enrollments.filter((e) => e.status === "confirmed").length
  const awaiting = enrollments.filter((e) => e.status === "registered").length
  const canAct = session.status !== "completed" && session.status !== "cancelled"

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={name ?? ""} description={`${practitioner} — ${date}`}>
        {canAct && (
          <>
            <Button
              variant="outline"
              className="gap-2 rounded-full px-5"
              onClick={onEnrollClick}
            >
              <HugeiconsIcon icon={Add01Icon} size={16} />
              {t("groupSessions.addPatient")}
            </Button>
            <Button
              variant="outline"
              className="gap-2 rounded-full px-5 text-destructive"
              onClick={() => cancelSessionMut.mutate(session.id)}
            >
              <HugeiconsIcon icon={Cancel01Icon} size={16} />
              {t("groupSessions.cancelSession")}
            </Button>
          </>
        )}
      </PageHeader>

      <div className="flex items-center gap-4">
        <Badge className={statusStyles[session.status]}>{session.status}</Badge>
        <span className="text-sm text-muted-foreground">
          {session.currentEnrollment}/{offering?.maxParticipants} {t("groupSessions.enrolled")}
          {confirmed > 0 && ` · ${confirmed} ${t("groupSessions.paid")}`}
          {awaiting > 0 && ` · ${awaiting} ${t("groupSessions.awaitingPayment")}`}
        </span>
      </div>
    </div>
  )
}
