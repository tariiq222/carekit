"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useLocale } from "@/components/locale-provider"
import { useGroupsMutations } from "@/hooks/use-groups-mutations"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Card } from "@/components/ui/card"
import type { Group, GroupEnrollment } from "@/lib/types/groups"

interface Props {
  group: Group
  enrollments: GroupEnrollment[]
}

export function GroupAttendanceForm({ group, enrollments }: Props) {
  const { t } = useLocale()
  const { completeGroupMut } = useGroupsMutations()

  const confirmedEnrollments = enrollments.filter((e) => e.status === "confirmed")
  const [attended, setAttended] = useState<Set<string>>(new Set())

  const toggleClient = (clientId: string) => {
    setAttended((prev) => {
      const next = new Set(prev)
      if (next.has(clientId)) next.delete(clientId)
      else next.add(clientId)
      return next
    })
  }

  const handleComplete = async () => {
    await completeGroupMut.mutateAsync({
      id: group.id,
      attendedClientIds: Array.from(attended),
    })
    toast.success(t("groups.groupCompleted"))
  }

  if (confirmedEnrollments.length === 0) return null

  return (
    <Card className="glass p-5 space-y-4">
      <h3 className="font-semibold">{t("groups.markAttendance")}</h3>

      <div className="flex flex-col gap-3">
        {confirmedEnrollments.map((enrollment) => {
          const p = enrollment.client
          const name = p ? `${p.firstName} ${p.lastName}` : enrollment.clientId
          return (
            <label key={enrollment.id} className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={attended.has(enrollment.clientId)}
                onCheckedChange={() => toggleClient(enrollment.clientId)}
              />
              <span className="text-sm">{name}</span>
            </label>
          )
        })}
      </div>

      <Button
        onClick={handleComplete}
        disabled={completeGroupMut.isPending}
        className="rounded-full px-6"
      >
        {completeGroupMut.isPending ? t("common.saving") : t("groups.completeGroup")}
      </Button>
    </Card>
  )
}
