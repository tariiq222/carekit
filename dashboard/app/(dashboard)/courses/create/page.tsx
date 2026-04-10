"use client"

import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { CourseTabs } from "@/components/features/courses/course-tabs"
import { useCoursesMutations } from "@/hooks/use-courses-mutations"
import { useLocale } from "@/components/locale-provider"
import { createCourseSchema, type CourseFormValues } from "@/lib/schemas/courses.schema"

export default function CreateCoursePage() {
  const router = useRouter()
  const { t } = useLocale()
  const { createCourseMut } = useCoursesMutations()

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(createCourseSchema),
    defaultValues: {
      nameAr: "",
      nameEn: "",
      descriptionAr: "",
      descriptionEn: "",
      practitionerId: "",
      totalSessions: 8,
      durationPerSessionMin: 60,
      frequency: "weekly",
      startDate: "",
      priceHalalat: 0,
      isGroup: false,
      maxParticipants: undefined,
      deliveryMode: "in_person",
      location: "",
    },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      const payload = {
        ...data,
        descriptionAr: data.descriptionAr || undefined,
        descriptionEn: data.descriptionEn || undefined,
        location: data.location || undefined,
        maxParticipants: data.isGroup ? data.maxParticipants : undefined,
      }
      await createCourseMut.mutateAsync(payload)
      toast.success(t("courses.courseCreated"))
      router.push("/services?tab=courses")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"))
    }
  })

  return (
    <ListPageShell>
      <Breadcrumbs items={[
        { label: t("courses.title"), href: "/services?tab=courses" },
        { label: t("courses.addCourse") },
      ]} />

      <PageHeader
        title={t("courses.addCourse")}
        description={t("courses.description")}
      />

      <CourseTabs
        form={form}
        onSubmit={onSubmit}
        onCancel={() => router.push("/services?tab=courses")}
        isPending={createCourseMut.isPending}
      />
    </ListPageShell>
  )
}
