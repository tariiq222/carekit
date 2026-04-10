"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
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

/* ─── Props ─── */

interface GroupFormPageProps {
  mode: "create"
}

/* ─── Component ─── */

export function GroupFormPage(_props: GroupFormPageProps) {
  const { t } = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { createGroupMut } = useGroupsMutations()

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

  /* ── Submit ── */
  const handleSubmit = async (data: CreateGroupFormValues) => {
    const practitionerId = pendingPractitionerIds[0]
    if (!practitionerId) {
      toast.error(t("groups.create.practitionerRequired"))
      return
    }

    setIsSubmitting(true)
    try {
      await createGroupMut.mutateAsync({ ...data, practitionerId })
      toast.success(t("groups.create.success"))
      router.push("/services?tab=groups")
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
    ? t("groups.create.submitting")
    : t("groups.create.submit")

  return (
    <ListPageShell>
      <Breadcrumbs
        items={[
          { label: t("groups.title"), href: "/services?tab=groups" },
          { label: t("groups.addGroup") },
        ]}
      />

      <PageHeader
        title={t("groups.create.pageTitle")}
        description={t("groups.create.pageDescription")}
      />

      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <Tabs defaultValue={initialTab}>
          <div className="overflow-x-auto pb-1 -mb-1">
            <TabsList className="min-w-max">
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

          <TabsContent value="general" className="pt-4">
            <GeneralInfoTab form={form} />
          </TabsContent>

          <TabsContent value="scheduling" className="pt-4">
            <SchedulingPriceTab form={form} />
          </TabsContent>

          <TabsContent value="settings" className="pt-4">
            <SettingsTab form={form} />
          </TabsContent>

          <TabsContent value="practitioners" className="pt-4">
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
