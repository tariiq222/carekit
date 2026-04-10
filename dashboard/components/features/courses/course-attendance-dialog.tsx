"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useLocale } from "@/components/locale-provider"
import { useCoursesMutations } from "@/hooks/use-courses-mutations"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import type { Course, CourseSession } from "@/lib/types/courses"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  course: Course
  session: CourseSession
}

export function CourseAttendanceDialog({ open, onOpenChange, course, session }: Props) {
  const { t } = useLocale()
  const { markAttendanceMut } = useCoursesMutations()

  const activeEnrollments = (course.enrollments ?? []).filter(
    (e) => e.status === "enrolled" || e.status === "active",
  )

  const [attended, setAttended] = useState<Set<string>>(new Set())

  const toggle = (patientId: string) => {
    setAttended((prev) => {
      const next = new Set(prev)
      if (next.has(patientId)) next.delete(patientId)
      else next.add(patientId)
      return next
    })
  }

  const handleSubmit = async () => {
    await markAttendanceMut.mutateAsync({
      courseId: course.id,
      sessionId: session.id,
      attendedPatientIds: Array.from(attended),
    })
    toast.success(t("courses.attendanceMarked"))
    setAttended(new Set())
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("courses.markAttendance")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          {activeEnrollments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("courses.noEnrollments")}</p>
          ) : (
            activeEnrollments.map((enrollment) => {
              const p = enrollment.patient
              const name = p ? `${p.firstName} ${p.lastName}` : enrollment.patientId
              return (
                <label key={enrollment.id} className="flex items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={attended.has(enrollment.patientId)}
                    onCheckedChange={() => toggle(enrollment.patientId)}
                  />
                  <span className="text-sm">{name}</span>
                </label>
              )
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={markAttendanceMut.isPending || activeEnrollments.length === 0}
          >
            {markAttendanceMut.isPending ? t("common.saving") : t("courses.markAttendance")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
