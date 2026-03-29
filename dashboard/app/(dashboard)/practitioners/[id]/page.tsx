"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"

export default function PractitionerDetailRoute() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  useEffect(() => {
    router.replace(`/practitioners/${id}/edit`)
  }, [id, router])

  return null
}
