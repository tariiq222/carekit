"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useLocale } from "@/components/locale-provider"
import { usePatient, usePatientMutations } from "@/hooks/use-patients"
import { editPatientSchema, type EditPatientFormData } from "@/lib/schemas/patient.schema"
import { PatientFormFields } from "@/components/features/patients/patient-form"

export default function EditPatientPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { t } = useLocale()

  const { data: patient, isLoading } = usePatient(params.id)
  const { updateMut } = usePatientMutations()

  const form = useForm<EditPatientFormData>({ resolver: zodResolver(editPatientSchema) })

  useEffect(() => {
    if (!patient) return
    form.reset({
      firstName:         patient.firstName ?? "",
      middleName:        patient.middleName ?? "",
      lastName:          patient.lastName ?? "",
      gender:            (patient.gender as "male" | "female") ?? undefined,
      dateOfBirth:       patient.dateOfBirth ? patient.dateOfBirth.split("T")[0] : "",
      nationality:       patient.nationality ?? "",
      nationalId:        patient.nationalId ?? "",
      phone:             patient.phone ?? "",
      emergencyName:     patient.emergencyName ?? "",
      emergencyPhone:    patient.emergencyPhone ?? "",
      bloodType:         (patient.bloodType as EditPatientFormData["bloodType"]) ?? undefined,
      allergies:         patient.allergies ?? "",
      chronicConditions: patient.chronicConditions ?? "",
      isActive:          patient.isActive ?? true,
    })
  }, [patient, form])

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await updateMut.mutateAsync({ id: params.id, payload: data })
      toast.success(t("patients.edit.changesSaved"))
      router.push("/patients")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("patients.edit.error"))
    }
  })

  if (isLoading) {
    return (
      <ListPageShell>
        <Breadcrumbs />
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[240px] rounded-xl" />
          ))}
        </div>
      </ListPageShell>
    )
  }

  const patientName = patient ? `${patient.firstName} ${patient.lastName}` : ""

  return (
    <ListPageShell>
      <Breadcrumbs items={[
        { label: t("nav.dashboard"), href: "/" },
        { label: t("nav.patients"), href: "/patients" },
        { label: patientName, href: `/patients/${params.id}` },
        { label: t("nav.edit") },
      ]} />
      <PageHeader
        title={t("patients.edit.title")}
        description={`${t("patients.edit.descriptionPrefix")} ${patientName}`}
      />

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <PatientFormFields
          form={form}
          errors={form.formState.errors}
          mode="edit"
        />

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.push("/patients")}>
            {t("patients.edit.cancel")}
          </Button>
          <Button type="submit" disabled={updateMut.isPending}>
            {updateMut.isPending
              ? t("patients.edit.saving")
              : t("patients.edit.saveChanges")}
          </Button>
        </div>
      </form>
    </ListPageShell>
  )
}
