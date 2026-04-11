"use client"

import { useParams } from "next/navigation"
import { PatientDetailPage } from "@/components/features/patients/patient-detail-page"

export default function PatientDetailRoute() {
  const { id } = useParams<{ id: string }>()
  return <PatientDetailPage patientId={id} />
}
