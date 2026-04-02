import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { UseFormReturn } from "react-hook-form"
import type { CreatePractitionerFormData } from "@/components/features/practitioners/create/form-schema"
import type { LocalBreak, LocalVacation } from "@/components/features/practitioners/create/schedule-tab"
import type { DraftService } from "@/components/features/practitioners/create/services-tab"
import type { AvailabilitySlot, PractitionerService } from "@/lib/types/practitioner"
import {
  assignService,
} from "@/lib/api/practitioners"
import {
  usePractitionerMutations,
  useSetAvailability,
  useSetBreaks,
  useVacationMutations,
  usePractitionerServiceMutations,
} from "@/hooks/use-practitioners"
import { useLocale } from "@/components/locale-provider"
import { z } from "zod"
import { createPractitionerSchema } from "@/components/features/practitioners/create/form-schema"

const _editPractitionerSchema = createPractitionerSchema.partial().extend({
  isActive: z.boolean(),
})
type EditPractitionerFormData = z.infer<typeof editPractitionerSchema>

const defaultSchedule: AvailabilitySlot[] = Array.from({ length: 7 }, (_, i) => ({
  dayOfWeek: i, startTime: "09:00", endTime: "17:00", isActive: i <= 4,
}))

interface UsePractitionerFormOptions {
  isEdit: boolean
  practitionerId: string | undefined
  practitioner: { user: { firstName: string; lastName: string }; title?: string | null; nameAr?: string | null; specialty?: string | null; specialtyAr?: string | null; bio?: string | null; bioAr?: string | null; experience?: number | null; education?: string | null; educationAr?: string | null; avatarUrl?: string | null; isActive: boolean } | undefined
  availability: AvailabilitySlot[] | undefined
  existingBreaks: { dayOfWeek: number; startTime: string; endTime: string }[] | undefined
  existingServices: PractitionerService[] | undefined
  form: UseFormReturn<CreatePractitionerFormData>
  schedule: AvailabilitySlot[]
  setSchedule: (s: AvailabilitySlot[]) => void
  breaks: LocalBreak[]
  setBreaksState: (b: LocalBreak[]) => void
  draftServices: DraftService[]
  setDraftServices: (ds: DraftService[]) => void
  vacation: LocalVacation
  setIsSubmitting: (v: boolean) => void
}

export function usePractitionerForm({
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
}: UsePractitionerFormOptions) {
  const router = useRouter()
  const { t } = useLocale()
  const { onboardMutation, updateMutation } = usePractitionerMutations()
  const setAvailabilityMut = useSetAvailability()
  const setBreaksMut = useSetBreaks()
  // practitionerId may be undefined during create — hooks safe with empty string (won't invalidate wrong key)
  const vacationMuts = useVacationMutations(practitionerId ?? "")
  const serviceMuts = usePractitionerServiceMutations(practitionerId ?? "")

  useEffect(() => {
    if (!practitioner) return
    form.reset({
      title: practitioner.title ?? "",
      nameEn: `${practitioner.user.firstName} ${practitioner.user.lastName}`.trim(),
      nameAr: practitioner.nameAr ?? "",
      specialty: practitioner.specialty ?? "",
      specialtyAr: practitioner.specialtyAr ?? "",
      bio: practitioner.bio ?? "",
      bioAr: practitioner.bioAr ?? "",
      experience: practitioner.experience ?? undefined,
      education: practitioner.education ?? "",
      educationAr: practitioner.educationAr ?? "",
      avatarUrl: practitioner.avatarUrl ?? "",
      isActive: practitioner.isActive,
    })
  }, [practitioner, form])

  useEffect(() => {
    if (!availability?.length) return
    const merged = defaultSchedule.map((def) => {
      const found = availability.find((a: AvailabilitySlot) => a.dayOfWeek === def.dayOfWeek)
      return found ?? { ...def, isActive: false }
    })
    setSchedule(merged)
  }, [availability, setSchedule])

  useEffect(() => {
    if (!existingBreaks?.length) return
    setBreaksState(existingBreaks.map(
      ({ dayOfWeek, startTime, endTime }, i: number) => ({
        key: `brk-existing-${i}`, dayOfWeek, startTime, endTime,
      }),
    ))
  }, [existingBreaks, setBreaksState])

  useEffect(() => {
    if (!existingServices?.length) return
    setDraftServices(existingServices.map((ps: PractitionerService) => ({
      key: ps.id, serviceId: ps.serviceId,
      serviceName: ps.service.nameAr || ps.service.nameEn,
      bufferMinutes: ps.bufferMinutes, isActive: ps.isActive,
      availableTypes: ps.availableTypes,
      types: (ps.serviceTypes ?? []).map((st) => ({
        bookingType: st.bookingType, price: st.price ?? undefined,
        duration: st.duration ?? undefined, isActive: st.isActive,
      })),
    })))
  }, [existingServices, setDraftServices])

  async function submitEdit(data: EditPractitionerFormData) {
    const id = practitionerId!
    try {
      await updateMutation.mutateAsync({
        id,
        title: data.title || undefined,
        nameAr: data.nameAr || undefined,
        specialty: data.specialty || undefined,
        specialtyAr: data.specialtyAr || undefined,
        bio: data.bio || undefined,
        bioAr: data.bioAr || undefined,
        experience: data.experience,
        education: data.education || undefined,
        educationAr: data.educationAr || undefined,
        avatarUrl: data.avatarUrl || undefined,
        isActive: data.isActive,
      })
      const activeSlots = schedule.filter((s) => s.isActive)
      if (activeSlots.length > 0) await setAvailabilityMut.mutateAsync({ id, schedule: activeSlots })
      if (breaks.length > 0) {
        await setBreaksMut.mutateAsync({
          id,
          breaks: breaks.map(({ dayOfWeek, startTime, endTime }) => ({
            dayOfWeek, startTime, endTime,
          })),
        })
      }
      if (vacation.enabled && vacation.startDate && vacation.endDate) {
        await vacationMuts.createMut.mutateAsync({
          startDate: vacation.startDate,
          endDate: vacation.endDate,
          reason: vacation.reason || undefined,
        })
      }
      const existingIds = new Set((existingServices ?? []).map((ps) => ps.serviceId))
      for (const ds of draftServices) {
        const payload = {
          availableTypes: ds.availableTypes, bufferMinutes: ds.bufferMinutes,
          isActive: ds.isActive, types: ds.types,
        }
        if (existingIds.has(ds.serviceId)) {
          await serviceMuts.updateMut.mutateAsync({ serviceId: ds.serviceId, payload })
        } else {
          await assignService(id, { serviceId: ds.serviceId, ...payload })
        }
      }
      toast.success(t("practitioners.edit.success"))
      router.push("/practitioners")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("practitioners.edit.error"))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function submitCreate(data: CreatePractitionerFormData) {
    const stepErrors: string[] = []
    let newId: string
    try {
      const result = await onboardMutation.mutateAsync({
        title: data.title || undefined,
        nameEn: data.nameEn,
        nameAr: data.nameAr,
        email: data.email,
        specialty: data.specialty,
        specialtyAr: data.specialtyAr || undefined,
        bio: data.bio || undefined,
        bioAr: data.bioAr || undefined,
        experience: data.experience,
        education: data.education || undefined,
        educationAr: data.educationAr || undefined,
        avatarUrl: data.avatarUrl || undefined,
        isActive: data.isActive,
      })
      newId = result.practitioner.id
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("practitioners.create.error"))
      setIsSubmitting(false)
      return
    }
    const activeSlots = schedule.filter((s) => s.isActive)
    if (activeSlots.length > 0) {
      try { await setAvailabilityMut.mutateAsync({ id: newId, schedule: activeSlots }) }
      catch { stepErrors.push("جدول المواعيد") }
    }
    if (breaks.length > 0) {
      try {
        await setBreaksMut.mutateAsync({
          id: newId,
          breaks: breaks.map(({ dayOfWeek, startTime, endTime }) => ({
            dayOfWeek, startTime, endTime,
          })),
        })
      } catch { stepErrors.push("فترات الاستراحة") }
    }
    if (vacation.enabled && vacation.startDate && vacation.endDate) {
      try {
        await vacationMuts.createMut.mutateAsync({
          startDate: vacation.startDate, endDate: vacation.endDate,
          reason: vacation.reason || undefined,
        })
      } catch { stepErrors.push("الإجازة") }
    }
    if (draftServices.length > 0) {
      try {
        await Promise.all(
          draftServices.map((ds) =>
            assignService(newId, {
              serviceId: ds.serviceId, availableTypes: ds.availableTypes,
              bufferMinutes: ds.bufferMinutes, isActive: ds.isActive, types: ds.types,
            }),
          ),
        )
      } catch { stepErrors.push("الخدمات") }
    }
    setIsSubmitting(false)
    if (stepErrors.length > 0) {
      toast.warning(`تم إنشاء الممارس الصحي، لكن فشل حفظ: ${stepErrors.join("، ")}`)
    } else {
      toast.success(t("practitioners.create.success"))
    }
    router.push("/practitioners")
  }

  const onSubmit = form.handleSubmit(async (data) => {
    if (isEdit) {
      await submitEdit(data as EditPractitionerFormData)
    } else {
      await submitCreate(data as CreatePractitionerFormData)
    }
  })

  return { onSubmit }
}
