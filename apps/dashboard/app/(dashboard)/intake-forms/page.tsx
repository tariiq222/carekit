"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  DocumentValidationIcon,
  CheckmarkCircle01Icon,
  FileEditIcon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { StatsGrid } from "@/components/features/stats-grid"
import { StatCard } from "@/components/features/stat-card"
import { DataTable } from "@/components/features/data-table"
import { FilterBar } from "@/components/features/filter-bar"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/components/locale-provider"
import { getIntakeFormsColumns } from "@/components/features/intake-forms/intake-forms-columns"
import { FormPreviewDialog } from "@/components/features/intake-forms/form-preview-dialog"
import { useIntakeForms, useIntakeFormMutations } from "@/hooks/use-intake-forms"
import type { IntakeForm } from "@/lib/types/intake-form"
import type { IntakeFormApi } from "@/lib/types/intake-form-api"

/* ─── Map API shape → frontend shape ─── */

function mapApiForm(f: IntakeFormApi): IntakeForm {
  const scopeId = f.serviceId ?? f.practitionerId ?? f.branchId ?? ""
  return {
    id: f.id,
    nameEn: f.nameEn,
    nameAr: f.nameAr,
    type: f.type,
    scope: f.scope,
    scopeId,
    scopeLabel: null,
    isActive: f.isActive,
    fieldsCount: f.fields?.length ?? 0,
    submissionsCount: f.submissionsCount,
    createdAt: f.createdAt,
    fields: f.fields?.map((fi) => ({
      id: fi.id,
      labelEn: fi.labelEn,
      labelAr: fi.labelAr,
      type: fi.fieldType,
      required: fi.isRequired,
      options: fi.options ?? [],
      condition: fi.condition ?? undefined,
    })),
  }
}

export default function IntakeFormsPage() {
  const { locale, t } = useLocale()
  const isAr = locale === "ar"
  const router = useRouter()

  const [search, setSearch] = useState("")
  const [previewForm, setPreviewForm] = useState<IntakeForm | null>(null)

  const { forms: rawForms } = useIntakeForms()
  const { update, updateLoading: _updateLoading, delete: deleteFn, deleteLoading: _deleteLoading } = useIntakeFormMutations()

  const forms = rawForms.map(mapApiForm)

  const totalForms = forms.length
  const activeForms = forms.filter((f) => f.isActive).length
  const totalSubmissions = forms.reduce((sum, f) => sum + f.submissionsCount, 0)

  const filteredForms = search.trim()
    ? forms.filter((f) => {
        const q = search.toLowerCase()
        return (
          f.nameEn.toLowerCase().includes(q) ||
          f.nameAr.includes(q) ||
          (f.scopeLabel ?? "").toLowerCase().includes(q)
        )
      })
    : forms

  function handleEdit(form: IntakeForm) {
    router.push(`/intake-forms/${form.id}/edit`)
  }

  function handleDelete(form: IntakeForm) {
    deleteFn(form.id, {
      onSuccess: () => toast.success(t("intakeForms.deleteSuccess")),
      onError: () => toast.error(t("intakeForms.deleteError")),
    })
  }

  function handleToggleActive(form: IntakeForm, value: boolean) {
    update(
      { formId: form.id, payload: { isActive: value } },
      {
        onSuccess: () =>
          toast.success(value ? t("intakeForms.activateSuccess") : t("intakeForms.deactivateSuccess")),
        onError: () => toast.error(t("intakeForms.updateError")),
      },
    )
  }

  const columns = getIntakeFormsColumns({
    isAr,
    t,
    onEdit: handleEdit,
    onDelete: handleDelete,
    onPreview: setPreviewForm,
    onToggleActive: handleToggleActive,
  })

  return (
    <ListPageShell>
      <PageHeader
        title={t("intakeForms.title")}
        description={t("intakeForms.description")}
      >
        <Button className="gap-2 rounded-full px-5" onClick={() => router.push("/intake-forms/create")}>
          <HugeiconsIcon icon={Add01Icon} size={16} />
          {t("intakeForms.newForm")}
        </Button>
      </PageHeader>

      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: t("intakeForms.searchPlaceholder") }}
        hasFilters={search.length > 0}
        onReset={() => setSearch("")}
      />

      <StatsGrid>
        <StatCard
          title={t("intakeForms.stats.total")}
          value={totalForms}
          icon={DocumentValidationIcon}
          iconColor="primary"
        />
        <StatCard
          title={t("intakeForms.stats.active")}
          value={activeForms}
          icon={CheckmarkCircle01Icon}
          iconColor="success"
        />
        <StatCard
          title={t("intakeForms.stats.submissions")}
          value={totalSubmissions.toLocaleString("en-US")}
          icon={FileEditIcon}
          iconColor="accent"
        />
      </StatsGrid>

      <DataTable
        columns={columns}
        data={filteredForms}
        emptyTitle={t("intakeForms.empty.title")}
        emptyDescription={t("intakeForms.empty.description")}
      />

      <FormPreviewDialog
        form={previewForm}
        open={!!previewForm}
        onClose={() => setPreviewForm(null)}
      />
    </ListPageShell>
  )
}
