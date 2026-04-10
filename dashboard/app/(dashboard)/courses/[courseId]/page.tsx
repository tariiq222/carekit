"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { ListPageShell } from "@/components/features/list-page-shell"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorBanner } from "@/components/features/error-banner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CourseDetailHeader } from "@/components/features/courses/course-detail-header"
import { CourseSessionsTable } from "@/components/features/courses/course-sessions-table"
import { CourseEnrollmentsTable } from "@/components/features/courses/course-enrollments-table"
import { EnrollPatientDialog } from "@/components/features/courses/enroll-patient-dialog"
import { useCourseDetail } from "@/hooks/use-courses"
import { useLocale } from "@/components/locale-provider"

export default function CourseDetailPage() {
  const { t, locale } = useLocale()
  const { courseId } = useParams<{ courseId: string }>()
  const { data: course, isLoading, error } = useCourseDetail(courseId)
  const [enrollOpen, setEnrollOpen] = useState(false)

  if (isLoading) {
    return (
      <ListPageShell>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </ListPageShell>
    )
  }

  if (error || !course) {
    return (
      <ListPageShell>
        <ErrorBanner message={error instanceof Error ? error.message : t("common.error")} />
      </ListPageShell>
    )
  }

  const name = locale === "ar" ? course.nameAr : course.nameEn

  return (
    <ListPageShell>
      <Breadcrumbs items={[
        { label: t("courses.title"), href: "/services?tab=courses" },
        { label: name },
      ]} />

      <CourseDetailHeader
        course={course}
        onEnrollClick={() => setEnrollOpen(true)}
      />

      <Tabs defaultValue="sessions">
        <TabsList>
          <TabsTrigger value="sessions">{t("courses.tabs.sessions")}</TabsTrigger>
          <TabsTrigger value="enrollments">{t("courses.tabs.enrollments")}</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions">
          <CourseSessionsTable sessions={course.sessions ?? []} />
        </TabsContent>

        <TabsContent value="enrollments">
          <CourseEnrollmentsTable
            enrollments={course.enrollments ?? []}
            courseId={course.id}
          />
        </TabsContent>
      </Tabs>

      <EnrollPatientDialog
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        courseId={course.id}
      />
    </ListPageShell>
  )
}
