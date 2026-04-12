"use client"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { useLocale } from "@/components/locale-provider"

export function InvoiceListPage() {
  const { t } = useLocale()

  return (
    <ListPageShell>
      <Breadcrumbs />

      <PageHeader
        title={t("invoices.title")}
        description={t("invoices.description")}
      />

      <div className="flex flex-col gap-6">
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {t("invoices.empty.description")}
          </p>
        </div>
      </div>
    </ListPageShell>
  )
}
