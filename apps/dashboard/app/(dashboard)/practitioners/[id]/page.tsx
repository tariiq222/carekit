"use client"

import { useParams } from "next/navigation"
import { PractitionerDetailPage } from "@/components/features/practitioners/practitioner-detail-page"

export default function PractitionerDetailRoute() {
  const { id } = useParams<{ id: string }>()
  return <PractitionerDetailPage practitionerId={id} />
}
