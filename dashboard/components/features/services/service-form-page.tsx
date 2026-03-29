"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { useQuery } from "@tanstack/react-query"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { BasicInfoTab } from "@/components/features/services/create/basic-info-tab"
import { PricingTab } from "@/components/features/services/create/pricing-tab"
import { BookingSettingsTab } from "@/components/features/services/create/booking-settings-tab"
import { IntakeFormsTab } from "@/components/features/services/intake-forms-tab"
import {
  createServiceSchema,
  createServiceDefaults,
  type CreateServiceFormData,
} from "@/components/features/services/create/form-schema"
import {
  mergeDraftsFromServer,
  type DraftBookingType,
} from "@/components/features/services/booking-types-editor"
import {
  useServiceMutations,
  useServiceBookingTypesMutation,
  useServiceBookingTypes,
} from "@/hooks/use-services"
import { fetchService } from "@/lib/api/services"
import { useLocale } from "@/components/locale-provider"
import { queryKeys } from "@/lib/query-keys"
import {
  buildPayload,
  saveBookingTypesApi,
  saveBookingTypesMutation,
} from "@/components/features/services/service-form-helpers"
import { uploadServiceImage } from "@/lib/api/services"

/* ─── Constants ─── */

const EMPTY_BOOKING_TYPES: DraftBookingType[] = [
  { bookingType: "in_person", enabled: true, price: 0, duration: 30, durationOptions: [] },
  { bookingType: "online", enabled: false, price: 0, duration: 30, durationOptions: [] },
]

/* ─── Props ─── */

interface ServiceFormPageProps {
  mode: "create" | "edit"
  serviceId?: string
}

/* ─── Component ─── */

export function ServiceFormPage({ mode, serviceId }: ServiceFormPageProps) {
  const { t, locale } = useLocale()
  const isAr = locale === "ar"
  const router = useRouter()
  const searchParams = useSearchParams()
  const isEdit = mode === "edit"
  const initialTab = searchParams.get("tab") ?? "basic"

  /* ── Data fetching (edit only) ── */
  const { data: service, isLoading, isError } = useQuery({
    queryKey: queryKeys.services.detail(serviceId ?? ""),
    queryFn: () => fetchService(serviceId!),
    enabled: isEdit && !!serviceId,
    retry: false,
  })

  const { data: existingBookingTypes } = useServiceBookingTypes(isEdit ? serviceId! : "")

  /* ── Mutations ── */
  const { createMut, updateMut } = useServiceMutations()
  const bookingTypesMutation = useServiceBookingTypesMutation(serviceId ?? "")

  /* ── Local state ── */
  const [bookingTypes, setBookingTypes] = useState<DraftBookingType[]>(EMPTY_BOOKING_TYPES)
  const [bookingTypesDirty, setBookingTypesDirty] = useState(false)
  const [pendingPractitionerIds, setPendingPractitionerIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const pendingAvatarFile = useRef<File | null>(null)

  /* ── Form ── */
  const form = useForm<CreateServiceFormData>({
    resolver: zodResolver(createServiceSchema),
    defaultValues: createServiceDefaults,
  })

  /* ── Populate form on edit ── */
  useEffect(() => {
    if (!service || !isEdit) return
    form.reset({
      nameEn: service.nameEn,
      nameAr: service.nameAr,
      descriptionEn: service.descriptionEn ?? "",
      descriptionAr: service.descriptionAr ?? "",
      categoryId: service.categoryId ?? "",
      isActive: service.isActive,
      isHidden: service.isHidden,
      hidePriceOnBooking: service.hidePriceOnBooking,
      hideDurationOnBooking: service.hideDurationOnBooking,
      calendarColor: service.calendarColor ?? null,
      iconName: service.iconName ?? null,
      iconBgColor: service.iconBgColor ?? null,
      imageUrl: service.imageUrl ?? null,
      bufferMinutes: service.bufferMinutes ?? undefined,
      depositEnabled: service.depositEnabled,
      depositPercent: service.depositPercent ?? 100,
      allowRecurring: service.allowRecurring,
      allowedRecurringPatterns: service.allowedRecurringPatterns ?? [],
      maxRecurrences: service.maxRecurrences ?? 12,
      maxParticipants: service.maxParticipants ?? 1,
      minLeadMinutes: service.minLeadMinutes ?? null,
      maxAdvanceDays: service.maxAdvanceDays ?? null,
    })
  }, [service, isEdit, form])

  /* ── Populate booking types on edit ── */
  useEffect(() => {
    if (!existingBookingTypes || bookingTypesDirty || !isEdit) return
    setBookingTypes(mergeDraftsFromServer(existingBookingTypes))
  }, [existingBookingTypes, bookingTypesDirty, isEdit])

  const handleBookingTypesChange = (types: DraftBookingType[]) => {
    setBookingTypes(types)
    if (isEdit) setBookingTypesDirty(true)
  }

  /* ── Submit ── */
  const handleSubmit = async (data: CreateServiceFormData) => {
    setIsSubmitting(true)
    try {
      if (isEdit && serviceId) {
        const firstEnabled = bookingTypes.find((bt) => bt.enabled)
        await updateMut.mutateAsync({
          id: serviceId,
          ...buildPayload(data),
          price: firstEnabled ? Math.round(firstEnabled.price * 100) : undefined,
          duration: firstEnabled ? firstEnabled.duration : undefined,
        })

        if (pendingAvatarFile.current) {
          await uploadServiceImage(serviceId, pendingAvatarFile.current)
          pendingAvatarFile.current = null
        }

        if (bookingTypesDirty) {
          await saveBookingTypesMutation(serviceId, bookingTypes, bookingTypesMutation)
        }

        toast.success(t("services.edit.success"))
      } else {
        const created = await createMut.mutateAsync({
          ...buildPayload(data),
          practitionerIds: pendingPractitionerIds.length > 0 ? pendingPractitionerIds : undefined,
        })

        if (pendingAvatarFile.current) {
          await uploadServiceImage(created.id, pendingAvatarFile.current)
          pendingAvatarFile.current = null
        }

        await saveBookingTypesApi(created.id, bookingTypes)
        toast.success(t("services.create.success"))
      }

      router.push("/services")
    } catch (err) {
      const key = isEdit ? "services.edit.error" : "services.create.error"
      toast.error(err instanceof Error ? err.message : t(key))
    } finally {
      setIsSubmitting(false)
    }
  }

  const onSubmit = form.handleSubmit(handleSubmit, (errors) => {
    const firstError = Object.values(errors)[0] as { message?: string } | undefined
    toast.error(firstError?.message ?? t("services.formError"))
  })

  /* ── Loading / Error states (edit only) ── */
  if (isEdit && isLoading) {
    return (
      <ListPageShell>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
        <div className="mt-6 space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </ListPageShell>
    )
  }

  if (isEdit && (isError || !service)) {
    return (
      <ListPageShell>
        <Breadcrumbs />
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <p className="text-sm font-semibold text-foreground">
            {t("services.notFound.title")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("services.notFound.desc")}
          </p>
          <Button variant="outline" onClick={() => router.push("/services")}>
            {t("services.notFound.back")}
          </Button>
        </div>
      </ListPageShell>
    )
  }

  /* ── Breadcrumbs ── */
  const breadcrumbItems = isEdit && service
    ? [
        { label: t("nav.dashboard"), href: "/" },
        { label: t("nav.services"), href: "/services" },
        { label: isAr ? (service.nameAr ?? "…") : (service.nameEn ?? "…"), href: `/services/${serviceId}/edit` },
        { label: t("nav.edit") },
      ]
    : undefined

  const submitLabel = isSubmitting
    ? t(isEdit ? "services.edit.submitting" : "services.create.submitting")
    : t(isEdit ? "services.edit.submit" : "services.create.submit")

  return (
    <ListPageShell>
      <Breadcrumbs items={breadcrumbItems} />

      <PageHeader
        title={t(isEdit ? "services.edit.title" : "services.create.pageTitle")}
        description={
          isEdit
            ? (isAr ? service?.nameAr : service?.nameEn)
            : t("services.create.pageDescription")
        }
      />

      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <Tabs defaultValue={initialTab}>
          <div className="overflow-x-auto pb-1 -mb-1">
            <TabsList className="min-w-max">
              <TabsTrigger value="basic" className="text-xs sm:text-sm">{t("services.create.tabs.basic")}</TabsTrigger>
              <TabsTrigger value="pricing" className="text-xs sm:text-sm">{t("services.create.tabs.pricing")}</TabsTrigger>
              <TabsTrigger value="booking" className="text-xs sm:text-sm">{t("services.create.tabs.booking")}</TabsTrigger>
              <TabsTrigger value="intake" className="text-xs sm:text-sm">
                {t("services.tabs.intake")}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="basic" className="pt-4 space-y-4">
            <BasicInfoTab
              form={form}
              onImageSelect={(file) => { pendingAvatarFile.current = file }}
              serviceId={serviceId}
              serviceBranches={service?.branches}
              isCreate={!isEdit}
              pendingPractitionerIds={pendingPractitionerIds}
              onPendingPractitionerChange={setPendingPractitionerIds}
            />
          </TabsContent>

          <TabsContent value="pricing" className="pt-4">
            <PricingTab
              bookingTypes={bookingTypes}
              onBookingTypesChange={handleBookingTypesChange}
            />
          </TabsContent>

          <TabsContent value="booking" className="pt-4">
            <BookingSettingsTab form={form} />
          </TabsContent>

          <TabsContent value="intake" className="pt-4">
            {isEdit && serviceId ? (
              <IntakeFormsTab serviceId={serviceId} />
            ) : (
              <div className="rounded-lg border border-border bg-surface-muted p-6 flex flex-col gap-3">
                <p className="text-sm font-semibold text-foreground">{t("services.intake.createHint.title")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("services.intake.createHint.desc")}{" "}
                  <span className="text-primary font-medium">
                    {t("services.intake.createHint.link")}
                  </span>{" "}
                  {t("services.intake.createHint.descSuffix")}
                </p>
              </div>
            )}
          </TabsContent>

        </Tabs>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => router.push("/services")}>
            {t(isEdit ? "services.edit.cancel" : "services.create.cancel")}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </ListPageShell>
  )
}

