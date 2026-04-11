"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { BasicInfoTab } from "@/components/features/practitioners/basic-info-tab"
import {
  ScheduleTab,
  type LocalBreak,
  type LocalVacation,
} from "@/components/features/practitioners/create/schedule-tab"
import {
  ServicesTab,
  type DraftService,
} from "@/components/features/practitioners/create/services-tab"
import {
  createPractitionerSchema,
  createPractitionerDefaults,
  type CreatePractitionerFormData,
} from "@/components/features/practitioners/create/form-schema"
import {
  usePractitioner,
  usePractitionerAvailability,
  usePractitionerBreaks,
  usePractitionerServices,
} from "@/hooks/use-practitioners"
import type { AvailabilitySlot } from "@/lib/types/practitioner"
import { useLocale } from "@/components/locale-provider"
import { usePractitionerForm } from "@/components/features/practitioners/use-practitioner-form"

/* ─── Edit Schema ─── */

const editPractitionerSchema = createPractitionerSchema.partial().extend({
  isActive: z.boolean(),
})

/* ─── Types ─── */

type Props =
  | { mode: "create" }
  | { mode: "edit"; practitionerId: string }

const defaultSchedule: AvailabilitySlot[] = Array.from({ length: 7 }, (_, i) => ({
  dayOfWeek: i, startTime: "09:00", endTime: "17:00", isActive: i <= 4,
}))

/* ─── Component ─── */

export function PractitionerFormPage(props: Props) {
  const isEdit = props.mode === "edit"
  const practitionerId = isEdit ? props.practitionerId : undefined

  const router = useRouter()
  const { t } = useLocale()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: practitioner, isLoading } = usePractitioner(practitionerId ?? null)
  const { data: availability } = usePractitionerAvailability(practitionerId ?? null)
  const { data: existingBreaks } = usePractitionerBreaks(practitionerId ?? null)
  const { data: existingServices } = usePractitionerServices(practitionerId ?? null)

  const [schedule, setSchedule] = useState<AvailabilitySlot[]>(defaultSchedule)
  const [breaks, setBreaksState] = useState<LocalBreak[]>([])
  const [draftServices, setDraftServices] = useState<DraftService[]>([])
  const [vacation, setVacation] = useState<LocalVacation>({ enabled: false, startDate: "", endDate: "", reason: "" })

  const form = useForm<CreatePractitionerFormData>({
      resolver: zodResolver(isEdit ? (editPractitionerSchema as unknown as typeof createPractitionerSchema) : createPractitionerSchema) as never,
    defaultValues: isEdit ? undefined : createPractitionerDefaults,
  })

  /* ─── Form logic (effects + submit) ─── */

  const { onSubmit } = usePractitionerForm({
    isEdit,
    practitionerId,
    practitioner,
    availability,
    existingBreaks,
    existingServices,
    form,
    schedule,
    setSchedule,
    breaks,
    setBreaksState,
    draftServices,
    setDraftServices,
    vacation,
    setIsSubmitting,
  })

  /* ─── Loading skeleton (edit only) ─── */

  if (isEdit && isLoading) {
    return (
      <ListPageShell>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
        <div className="mt-6 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      </ListPageShell>
    )
  }

  /* ─── Render ─── */

  const title = isEdit ? t("practitioners.edit.pageTitle") : t("practitioners.create.pageTitle")
  const description = isEdit
    ? practitioner ? `${practitioner.user.firstName} ${practitioner.user.lastName}` : ""
    : t("practitioners.create.pageDesc")

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader title={title} description={description} />

      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <Tabs defaultValue="basic">
          <TabsList>
            <TabsTrigger value="basic">{t("practitioners.create.tabs.basic")}</TabsTrigger>
            <TabsTrigger value="schedule">{t("practitioners.create.tabs.schedule")}</TabsTrigger>
            <TabsTrigger value="services">{t("practitioners.create.tabs.services")}</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="pt-4 space-y-4">
            <BasicInfoTab
              form={form}
              showEmail={!isEdit}
              practitionerName={
                isEdit && practitioner
                  ? `${practitioner.user.firstName} ${practitioner.user.lastName}`
                  : undefined
              }
            />
          </TabsContent>

          <TabsContent value="schedule" className="pt-4 space-y-4">
            <ScheduleTab
              schedule={schedule}
              onScheduleChange={setSchedule}
              breaks={breaks}
              onBreaksChange={setBreaksState}
              vacation={vacation}
              onVacationChange={setVacation}
            />
          </TabsContent>

          <TabsContent value="services" className="pt-4">
            <ServicesTab draftServices={draftServices} onDraftServicesChange={setDraftServices} />
          </TabsContent>
        </Tabs>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => router.push("/practitioners")}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? t(isEdit ? "practitioners.edit.submitting" : "practitioners.create.submitting")
              : t(isEdit ? "practitioners.edit.submit" : "practitioners.create.submit")}
          </Button>
        </div>
      </form>
    </ListPageShell>
  )
}
