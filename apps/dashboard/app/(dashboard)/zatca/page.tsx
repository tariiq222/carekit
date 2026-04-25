"use client"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { ZatcaTab } from "@/components/features/invoices/zatca-tab"
import { useLocale } from "@/components/locale-provider"

export default function ZatcaRoute() {
  const { t } = useLocale()
  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader
        title={t("zatca.title")}
        description={t("zatca.description")}
      />
      <ZatcaTab />
    </ListPageShell>
  )
}
