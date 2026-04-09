"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useLocale } from "@/components/locale-provider"
import { useGroupSessionsMutations } from "@/hooks/use-group-sessions-mutations"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
}

export function EnrollPatientDialog({ open, onOpenChange, sessionId }: Props) {
  const { t } = useLocale()
  const { enrollPatientMut } = useGroupSessionsMutations()
  const [patientId, setPatientId] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!patientId.trim()) return
    await enrollPatientMut.mutateAsync({ sessionId, patientId: patientId.trim() })
    toast.success(t("groupSessions.patientEnrolled"))
    setPatientId("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("groupSessions.addPatient")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label>{t("groupSessions.patientId")}</Label>
            <Input
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              placeholder={t("groupSessions.patientIdPlaceholder")}
            />
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleSubmit} disabled={enrollPatientMut.isPending || !patientId.trim()}>
            {enrollPatientMut.isPending ? t("common.saving") : t("groupSessions.enroll")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
