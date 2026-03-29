"use client"

import { useParams } from "next/navigation"
import { ServiceFormPage } from "@/components/features/services/service-form-page"

export default function EditServicePage() {
  const params = useParams()
  return <ServiceFormPage mode="edit" serviceId={params.id as string} />
}
