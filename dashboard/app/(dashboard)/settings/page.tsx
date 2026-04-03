"use client"

import { toast } from "sonner"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { useLocale } from "@/components/locale-provider"
import { useConfigMap, useUpdateConfig } from "@/hooks/use-whitelabel"

import { GeneralTab } from "@/components/features/settings/general-tab"
import { BookingTab } from "@/components/features/settings/booking-tab"
import { CancellationTab } from "@/components/features/settings/cancellation-tab"
import { NotificationsTab } from "@/components/features/settings/notifications-tab"
import { WorkingHoursTab } from "@/components/features/settings/working-hours-tab"
import { SettingsPaymentTab } from "@/components/features/settings/settings-payment-tab"
import { SettingsIntegrationsTab } from "@/components/features/settings/settings-integrations-tab"
import { ZatcaTab } from "@/components/features/invoices/zatca-tab"
import { EmailTemplatesTab } from "@/components/features/settings/email-templates-tab"
import { WidgetTab } from "@/components/features/settings/widget-tab"

export default function SettingsPage() {
  const { t } = useLocale()
  const { data: configMap, isLoading } = useConfigMap()
  const mutation = useUpdateConfig()

  const onMutationSuccess = () => toast.success(t("settings.saved"))
  const onMutationError = () => toast.error(t("settings.error") ?? "Failed to save settings")

  const handleSave = (configs: { key: string; value: string; type?: string }[]) => {
    const nonEmpty = configs.filter((c) => c.type === "boolean" || c.value.trim() !== "")
    if (nonEmpty.length === 0) return
    mutation.mutate(
      {
        configs: nonEmpty.map((c) => ({
          key: c.key,
          value: c.value,
          ...(c.type ? { type: c.type as "string" | "number" | "boolean" | "json" } : {}),
        })),
      },
      { onSuccess: onMutationSuccess, onError: onMutationError },
    )
  }

  if (isLoading) {
    return (
      <ListPageShell>
        <Breadcrumbs />
        <PageHeader title={t("settings.title")} description={t("settings.description")} />
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
      <PageHeader title={t("settings.title")} description={t("settings.description")} />

      <Tabs defaultValue="general">
        <div className="overflow-x-auto">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="general">{t("settings.tabs.general")}</TabsTrigger>
            <TabsTrigger value="booking">{t("settings.tabs.booking")}</TabsTrigger>
            <TabsTrigger value="cancellation">{t("settings.tabs.cancellation")}</TabsTrigger>
            <TabsTrigger value="notifications">{t("settings.tabs.notifications")}</TabsTrigger>
            <TabsTrigger value="hours">{t("settings.tabs.hours")}</TabsTrigger>
            <TabsTrigger value="payment">{t("settings.tabs.payment")}</TabsTrigger>
            <TabsTrigger value="integrations">{t("settings.tabs.integrations")}</TabsTrigger>
            <TabsTrigger value="zatca">{t("invoices.tabs.zatca")}</TabsTrigger>
            <TabsTrigger value="email-templates">{t("settings.tabs.emailTemplates")}</TabsTrigger>
            <TabsTrigger value="widget">{t("settings.tabs.widget")}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="general" className="mt-4">
          <GeneralTab configMap={cfg} onSave={handleSave} isPending={mutation.isPending} t={t} />
        </TabsContent>
        <TabsContent value="booking" className="mt-4">
          <BookingTab t={t} />
        </TabsContent>
        <TabsContent value="cancellation" className="mt-4">
          <CancellationTab t={t} />
        </TabsContent>
        <TabsContent value="notifications" className="mt-4">
          <NotificationsTab configMap={cfg} onSave={handleSave} isPending={mutation.isPending} t={t} />
        </TabsContent>
        <TabsContent value="hours" className="mt-4">
          <WorkingHoursTab t={t} />
        </TabsContent>
        <TabsContent value="payment" className="mt-4">
          <SettingsPaymentTab />
        </TabsContent>
        <TabsContent value="integrations" className="mt-4">
          <SettingsIntegrationsTab />
        </TabsContent>
        <TabsContent value="zatca" className="mt-4">
          <ZatcaTab />
        </TabsContent>
        <TabsContent value="email-templates" className="mt-4">
          <EmailTemplatesTab />
        </TabsContent>
        <TabsContent value="widget" className="mt-4">
          <WidgetTab t={t} />
        </TabsContent>
      </Tabs>
    </ListPageShell>
  )
}
