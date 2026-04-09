"use client"

import { toast } from "sonner"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { useLocale } from "@/components/locale-provider"
import { useWhitelabel, useUpdateWhitelabel } from "@/hooks/use-whitelabel"
import { useAuth } from "@/components/providers/auth-provider"

import { BrandingTab } from "@/components/features/white-label/branding-tab"
import { WlFeaturesTab } from "@/components/features/white-label/wl-features-tab"
import type { UpdateWhitelabelPayload } from "@/lib/types/whitelabel"

export default function WhiteLabelPage() {
  const { t } = useLocale()
  const { canDo } = useAuth()
  const { data: whitelabel, isLoading } = useWhitelabel()
  const mutation = useUpdateWhitelabel()

  if (!canDo("whitelabel", "edit")) {
    return (
      <ListPageShell>
        <Breadcrumbs />
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg font-medium text-muted-foreground">{t("common.noPermission") ?? "ليس لديك صلاحية للوصول لهذه الصفحة"}</p>
        </div>
      </ListPageShell>
    )
  }

  const handleSave = (data: UpdateWhitelabelPayload) => {
    mutation.mutate(data, {
      onSuccess: () => toast.success(t("settings.saved")),
      onError: () => toast.error(t("settings.error")),
    })
  }

  if (isLoading) {
    return (
      <ListPageShell>
        <Breadcrumbs />
        <PageHeader title={t("whiteLabel.title")} description={t("whiteLabel.description")} />
        <div className="space-y-4">
          <Skeleton className="h-10 w-full sm:w-96" />
          <Skeleton className="h-[300px] rounded-lg" />
        </div>
      </ListPageShell>
    )
  }

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader title={t("whiteLabel.title")} description={t("whiteLabel.description")} />

      <Tabs defaultValue="branding">
        <div className="overflow-x-auto">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="branding">{t("whiteLabel.tabs.branding")}</TabsTrigger>
            <TabsTrigger value="license">{t("whiteLabel.tabs.license")}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="branding" className="mt-4">
          <BrandingTab
            whitelabel={whitelabel ?? null}
            onSave={handleSave}
            isPending={mutation.isPending}
          />
        </TabsContent>
        <TabsContent value="license" className="mt-4">
          <WlFeaturesTab />
        </TabsContent>
      </Tabs>
    </ListPageShell>
  )
}
