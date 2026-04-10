"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useLocale } from "@/components/locale-provider"
import { useCoursesMutations } from "@/hooks/use-courses-mutations"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  courseId: string
}

export function EnrollPatientDialog({ open, onOpenChange, courseId }: Props) {
  const { t } = useLocale()
  const { enrollPatientMut } = useCoursesMutations()
  const [patientId, setPatientId] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!patientId.trim()) return
    await enrollPatientMut.mutateAsync({ courseId, patientId: patientId.trim() })
    toast.success(t("courses.patientEnrolled"))
    setPatientId("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("courses.addPatient")}</DialogTitle>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={enrollPatientMut.isPending || !patientId.trim()}
          >
            {enrollPatientMut.isPending ? t("common.saving") : t("groupSessions.enroll")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
