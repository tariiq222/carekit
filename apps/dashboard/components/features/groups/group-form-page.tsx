"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { useQuery } from "@tanstack/react-query"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { GeneralInfoTab } from "@/components/features/groups/create/general-info-tab"
import { SchedulingPriceTab } from "@/components/features/groups/create/scheduling-price-tab"
import { SettingsTab } from "@/components/features/groups/create/settings-tab"
import { ServicePractitionersTab } from "@/components/features/services/service-practitioners-tab"
import {
  createGroupSchema,
  createGroupDefaults,
  type CreateGroupFormValues,
} from "@/lib/schemas/groups.schema"
import { useGroupsMutations } from "@/hooks/use-groups-mutations"
import { useLocale } from "@/components/locale-provider"
import { fetchGroup } from "@/lib/api/groups"
import { queryKeys } from "@/lib/query-keys"

/* ─── Props ─── */

interface GroupFormPageProps {
  mode: "create" | "edit"
  groupId?: string
}

/* ─── Component ─── */

export function GroupFormPage(props: GroupFormPageProps) {
  const { t } = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { createGroupMut, updateGroupMut } = useGroupsMutations()

  const isEdit = props.mode === "edit"

  const { data: group, isLoading: groupLoading } = useQuery({
    queryKey: queryKeys.groups.detail(props.groupId ?? ""),
    queryFn: () => fetchGroup(props.groupId!),
    enabled: isEdit && !!props.groupId,
  })

  const initialTab = searchParams.get("tab") ?? "general"

  /* ── Local state ── */
  const [pendingPractitionerIds, setPendingPractitionerIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  /* ── Form ── */
  const form = useForm<CreateGroupFormValues>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: {
      nameAr: "",
      nameEn: "",
      descriptionAr: "",
      descriptionEn: "",
      practitionerId: "",
      ...createGroupDefaults,
    },
  })

  /* ── Populate form in edit mode ── */
  useEffect(() => {
    if (!group || !isEdit) return
    setPendingPractitionerIds(group.practitionerId ? [group.practitionerId] : [])
    form.reset({
      nameAr: group.nameAr,
      nameEn: group.nameEn,
      descriptionAr: group.descriptionAr ?? "",
      descriptionEn: group.descriptionEn ?? "",
      practitionerId: group.practitionerId,
      minParticipants: group.minParticipants,
      maxParticipants: group.maxParticipants,
      pricePerPersonHalalat: group.pricePerPersonHalalat,
      durationMinutes: group.durationMinutes,
      paymentDeadlineHours: group.paymentDeadlineHours,
      paymentType: group.paymentType,
      depositAmount: group.depositAmount ?? undefined,
      schedulingMode: group.schedulingMode,
      startTime: group.startTime ?? undefined,
      endDate: group.endDate ?? undefined,
      deliveryMode: group.deliveryMode,
      location: group.location ?? "",
      meetingLink: group.meetingLink ?? "",
      isPublished: group.isPublished,
      expiresAt: group.expiresAt ?? undefined,
    })
  }, [group, isEdit, form])

  /* ── Submit ── */
  const handleSubmit = async (data: CreateGroupFormValues) => {
    const practitionerId = pendingPractitionerIds[0]
    if (!practitionerId) {
      toast.error(t("groups.create.practitionerRequired"))
      return
    }

    setIsSubmitting(true)
    try {
      if (isEdit && props.groupId) {
        await updateGroupMut.mutateAsync({ id: props.groupId, ...data, practitionerId })
        toast.success(t("groups.edit.success"))
        router.push(`/groups/${props.groupId}`)
      } else {
        const created = await createGroupMut.mutateAsync({ ...data, practitionerId })
        toast.success(t("groups.create.success"))
        router.push(`/groups/${created.id}`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("groups.create.error"))
    } finally {
      setIsSubmitting(false)
    }
  }

  const onSubmit = form.handleSubmit(handleSubmit, () => {
    toast.error(t("groups.create.formError"))
  })

  const submitLabel = isSubmitting
    ? (isEdit ? t("groups.edit.submitting") : t("groups.create.submitting"))
    : (isEdit ? t("groups.edit.submit") : t("groups.create.submit"))

  if (isEdit && groupLoading) {
    return (
      <ListPageShell>
        <Breadcrumbs
          items={[
            { label: t("groups.title"), href: "/services?tab=groups" },
            { label: t("groups.edit.pageTitle") },
          ]}
        />
        <PageHeader
          title={t("groups.edit.pageTitle")}
          description={t("groups.edit.pageDescription")}
        />
        <div className="flex flex-col gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      </ListPageShell>
    )
  }

  return (
    <ListPageShell>
      <Breadcrumbs
        items={[
          { label: t("groups.title"), href: "/services?tab=groups" },
          { label: isEdit ? t("groups.edit.pageTitle") : t("groups.addGroup") },
        ]}
      />

      <PageHeader
        title={isEdit ? t("groups.edit.pageTitle") : t("groups.create.pageTitle")}
        description={isEdit ? t("groups.edit.pageDescription") : t("groups.create.pageDescription")}
      />

      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <Tabs defaultValue={initialTab}>
          <div className="overflow-x-auto">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="general" className="text-xs sm:text-sm">
                {t("groups.create.tabs.general")}
              </TabsTrigger>
              <TabsTrigger value="scheduling" className="text-xs sm:text-sm">
                {t("groups.create.tabs.scheduling")}
              </TabsTrigger>
              <TabsTrigger value="settings" className="text-xs sm:text-sm">
                {t("groups.create.tabs.settings")}
              </TabsTrigger>
              <TabsTrigger value="practitioners" className="text-xs sm:text-sm">
                {t("groups.create.tabs.practitioners")}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="general" className="mt-4">
            <GeneralInfoTab form={form} />
          </TabsContent>
          <TabsContent value="scheduling" className="mt-4">
            <SchedulingPriceTab form={form} />
          </TabsContent>
          <TabsContent value="settings" className="mt-4">
            <SettingsTab form={form} />
          </TabsContent>
          <TabsContent value="practitioners" className="mt-4">
            <ServicePractitionersTab
              isCreate={true}
              pendingIds={pendingPractitionerIds}
              onPendingChange={setPendingPractitionerIds}
            />
          </TabsContent>
        </Tabs>

        <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 border-t border-border bg-background/80 backdrop-blur-sm px-4 sm:px-6 py-3 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/services?tab=groups")}
          >
            {t("groups.create.cancel")}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </ListPageShell>
  )
}
