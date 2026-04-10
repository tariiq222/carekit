"use client"

import { useLocale } from "@/components/locale-provider"
import { useCoursesMutations } from "@/hooks/use-courses-mutations"
import { PageHeader } from "@/components/features/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Cancel01Icon, BookOpen01Icon } from "@hugeicons/core-free-icons"
import type { Course, CourseStatus } from "@/lib/types/courses"

const statusStyles: Record<CourseStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-primary/10 text-primary border-primary/30",
  in_progress: "bg-warning/10 text-warning border-warning/30",
  completed: "bg-success/10 text-success border-success/30",
  archived: "bg-muted text-muted-foreground",
}

interface Props {
  course: Course
  onEnrollClick: () => void
}

export function CourseDetailHeader({ course, onEnrollClick }: Props) {
  const { t, locale } = useLocale()
  const { publishCourseMut, cancelCourseMut } = useCoursesMutations()

  const name = locale === "ar" ? course.nameAr : course.nameEn
  const practitioner = course.practitioner?.nameAr ?? ""

  const startDateDisplay = new Date(course.startDate).toLocaleDateString(
    locale === "ar" ? "ar-SA" : "en-US",
    { year: "numeric", month: "short", day: "numeric" },
  )

  const canPublish = course.status === "draft"
  const canCancel = course.status === "published" || course.status === "in_progress"
  const canEnroll = course.status === "published" || course.status === "in_progress"

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={name}
        description={`${practitioner} — ${startDateDisplay}`}
      >
        {canEnroll && (
          <Button variant="outline" className="gap-2 rounded-full px-5" onClick={onEnrollClick}>
            <HugeiconsIcon icon={Add01Icon} size={16} />
            {t("courses.addPatient")}
          </Button>
        )}
        {canPublish && (
          <Button
            variant="outline"
            className="gap-2 rounded-full px-5"
            onClick={() => publishCourseMut.mutate(course.id)}
            disabled={publishCourseMut.isPending}
          >
            <HugeiconsIcon icon={BookOpen01Icon} size={16} />
            {t("courses.publishCourse")}
          </Button>
        )}
        {canCancel && (
          <Button
            variant="outline"
            className="gap-2 rounded-full px-5 text-destructive"
            onClick={() => cancelCourseMut.mutate(course.id)}
            disabled={cancelCourseMut.isPending}
          >
            <HugeiconsIcon icon={Cancel01Icon} size={16} />
            {t("courses.cancelCourse")}
          </Button>
        )}
      </PageHeader>

      <div className="flex items-center gap-4 flex-wrap">
        <Badge className={statusStyles[course.status]}>
          {t(`courses.status.${course.status}`)}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {course.currentEnrollment}
          {course.maxParticipants ? `/${course.maxParticipants}` : ""} {t("courses.enrolled")}
        </span>
        <span className="text-sm text-muted-foreground">
          {course.totalSessions} {t("courses.sessions")}
        </span>
        <span className="text-sm text-muted-foreground">
          {t(`courses.deliveryMode.${course.deliveryMode}`)}
        </span>
        {course.location && (
          <span className="text-sm text-muted-foreground">{course.location}</span>
        )}
      </div>
    </div>
  )
}
