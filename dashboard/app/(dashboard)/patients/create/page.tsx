"use client"

import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { Button } from "@/components/ui/button"
import { usePatientMutations } from "@/hooks/use-patients"
import { useLocale } from "@/components/locale-provider"
import { createPatientSchema, type CreatePatientFormData } from "@/lib/schemas/patient.schema"
import { PatientFormFields } from "@/components/features/patients/patient-form"

export default function CreatePatientPage() {
  const router = useRouter()
  const { t } = useLocale()

  const { createMut } = usePatientMutations()

  const form = useForm<CreatePatientFormData>({
    resolver: zodResolver(createPatientSchema),
    defaultValues: {
      firstName: "", middleName: "", lastName: "", phone: "",
      emergencyName: "", emergencyPhone: "",
      allergies: "", chronicConditions: "",
    },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      const result = await createMut.mutateAsync(data) as { isExisting?: boolean }
      if (result?.isExisting) {
        toast.info(t("patients.create.alreadyRegistered"))
      } else {
        toast.success(t("patients.create.added"))
      }
      router.push("/patients")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("patients.create.error"))
    }
  })

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader
        title={t("patients.create.pageTitle")}
        description={t("patients.create.pageDescription")}
      />

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <PatientFormFields
          form={form}
          errors={form.formState.errors}
          mode="create"
        />

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.push("/patients")}>
            {t("patients.create.cancel")}
          </Button>
          <Button type="submit" disabled={createMut.isPending}>
            {createMut.isPending
              ? t("patients.create.saving")
              : t("patients.create.submit")}
          </Button>
        </div>
      </form>
    </ListPageShell>
  )
}
