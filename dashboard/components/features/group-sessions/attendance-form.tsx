"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useLocale } from "@/components/locale-provider"
import { useGroupSessionsMutations } from "@/hooks/use-group-sessions-mutations"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Card } from "@/components/ui/card"
import type { GroupSession } from "@/lib/types/group-sessions"

interface Props {
  session: GroupSession
}

export function AttendanceForm({ session }: Props) {
  const { t } = useLocale()
  const { completeSessionMut } = useGroupSessionsMutations()

  const confirmedEnrollments = (session.enrollments ?? []).filter(
    (e) => e.status === "confirmed",
  )

  const [attended, setAttended] = useState<Set<string>>(new Set())

  const togglePatient = (patientId: string) => {
    setAttended((prev) => {
      const next = new Set(prev)
      if (next.has(patientId)) next.delete(patientId)
      else next.add(patientId)
      return next
    })
  }

  const handleComplete = async () => {
    await completeSessionMut.mutateAsync({
      id: session.id,
      attendedPatientIds: Array.from(attended),
    })
    toast.success(t("groupSessions.sessionCompleted"))
  }

  if (confirmedEnrollments.length === 0) return null

  return (
    <Card className="glass p-5 space-y-4">
      <h3 className="font-semibold">{t("groupSessions.markAttendance")}</h3>

      <div className="flex flex-col gap-3">
        {confirmedEnrollments.map((enrollment) => {
          const p = enrollment.patient
          const name = p ? `${p.firstName} ${p.lastName}` : enrollment.patientId
          return (
            <label key={enrollment.id} className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={attended.has(enrollment.patientId)}
                onCheckedChange={() => togglePatient(enrollment.patientId)}
              />
              <span className="text-sm">{name}</span>
            </label>
          )
        })}
      </div>

      <Button
        onClick={handleComplete}
        disabled={completeSessionMut.isPending}
        className="rounded-full px-6"
      >
        {completeSessionMut.isPending
          ? t("common.saving")
          : t("groupSessions.completeSession")}
      </Button>
    </Card>
  )
}
