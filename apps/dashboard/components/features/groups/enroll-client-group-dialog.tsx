"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useLocale } from "@/components/locale-provider"
import { useGroupsMutations } from "@/hooks/use-groups-mutations"
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
  onClose: () => void
  groupId: string
}

export function EnrollPatientGroupDialog({ open, onClose, groupId }: Props) {
  const { t } = useLocale()
  const { enrollPatientMut } = useGroupsMutations()
  const [patientId, setPatientId] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!patientId.trim()) return
    try {
      await enrollPatientMut.mutateAsync({ groupId, patientId: patientId.trim() })
      toast.success(t("groups.patientEnrolled"))
      setPatientId("")
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("groups.addPatient")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label>{t("groups.patientId")}</Label>
            <Input
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              placeholder={t("groups.patientIdPlaceholder")}
            />
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button
            onClick={handleSubmit}
            disabled={enrollPatientMut.isPending || !patientId.trim()}
          >
            {enrollPatientMut.isPending ? t("common.saving") : t("groups.enroll")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
