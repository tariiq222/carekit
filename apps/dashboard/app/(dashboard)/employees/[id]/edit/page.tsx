"use client"

import { useParams } from "next/navigation"
import { PractitionerFormPage } from "@/components/features/practitioners/practitioner-form-page"

export default function EditPractitionerPage() {
  const { id } = useParams<{ id: string }>()
  return <PractitionerFormPage mode="edit" practitionerId={id} />
}
