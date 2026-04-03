"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { useLocale } from "@/components/locale-provider"
import { queryKeys } from "@/lib/query-keys"
import { fetchConfigMap, updateConfig } from "@/lib/api/whitelabel"

import { BrandingTab } from "@/components/features/white-label/branding-tab"
import { EntityTab } from "@/components/features/white-label/entity-tab"
import { TechnicalTab } from "@/components/features/white-label/technical-tab"
import { LegalTab } from "@/components/features/white-label/legal-tab"
import { WlFeaturesTab } from "@/components/features/white-label/wl-features-tab"

export default function WhiteLabelPage() {
  const { t } = useLocale()
  const queryClient = useQueryClient()

  const { data: configMap, isLoading } = useQuery({
    queryKey: queryKeys.whitelabel.configMap(),
    queryFn: fetchConfigMap,
  })

  const mutation = useMutation({
    mutationFn: updateConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.whitelabel.all })
      toast.success(t("settings.saved"))
    },
    onError: () => toast.error(t("settings.error")),
  })

  const handleSave = (configs: { key: string; value: string; type?: string }[]) => {
    const nonEmpty = configs.filter((c) => c.value.trim() !== "")
    if (nonEmpty.length === 0) return
    mutation.mutate({
      configs: nonEmpty.map((c) => ({
        key: c.key,
        value: c.value,
        ...(c.type ? { type: c.type as "string" | "number" | "boolean" | "json" } : {}),
      })),
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

  const cfg = configMap ?? {}

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader title={t("whiteLabel.title")} description={t("whiteLabel.description")} />

      <Tabs defaultValue="branding">
        <div className="overflow-x-auto">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="branding">{t("whiteLabel.tabs.branding")}</TabsTrigger>
            <TabsTrigger value="entity">{t("whiteLabel.tabs.entity")}</TabsTrigger>
            <TabsTrigger value="technical">{t("whiteLabel.tabs.technical")}</TabsTrigger>
            <TabsTrigger value="legal">{t("whiteLabel.tabs.legal")}</TabsTrigger>
            <TabsTrigger value="features">{t("whiteLabel.tabs.features")}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="branding" className="mt-4">
          <BrandingTab configMap={cfg} onSave={handleSave} isPending={mutation.isPending} t={t} />
        </TabsContent>
        <TabsContent value="entity" className="mt-4">
          <EntityTab configMap={cfg} onSave={handleSave} isPending={mutation.isPending} t={t} />
        </TabsContent>
        <TabsContent value="technical" className="mt-4">
          <TechnicalTab configMap={cfg} onSave={handleSave} isPending={mutation.isPending} t={t} />
        </TabsContent>
        <TabsContent value="legal" className="mt-4">
          <LegalTab configMap={cfg} onSave={handleSave} isPending={mutation.isPending} t={t} />
        </TabsContent>
        <TabsContent value="features" className="mt-4">
          <WlFeaturesTab />
        </TabsContent>
      </Tabs>
    </ListPageShell>
  )
}
