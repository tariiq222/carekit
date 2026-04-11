"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { fetchIntakeResponses } from "@/lib/api/services"
import { DetailSection, DetailRow } from "@/components/features/detail-sheet-parts"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { useLocale } from "@/components/locale-provider"
import { format } from "date-fns"

interface Props {
  bookingId: string
}

export function IntakeResponsesViewer({ bookingId }: Props) {
  const { locale, t } = useLocale()

  const { data: responses, isLoading } = useQuery({
    queryKey: queryKeys.services.intakeResponses(bookingId),
    queryFn: () => fetchIntakeResponses(bookingId),
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (!responses || responses.length === 0) return null

  return (
    <>
      {responses.map((response) => {
        const form = response.form
        const formTitle = form
          ? locale === "ar" ? form.titleAr : form.titleEn
          : t("detail.intakeForm")

        const fields = form?.fields?.sort((a, b) => a.sortOrder - b.sortOrder) ?? []

        return (
          <DetailSection key={response.id} title={formTitle}>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-[10px]">
                {t("detail.submittedAt")}{" "}
                {format(new Date(response.createdAt), "MMM d, yyyy HH:mm")}
              </Badge>
            </div>
            {fields.length > 0 ? (
              fields.map((field) => {
                const label = locale === "ar" ? field.labelAr : field.labelEn
                const answer = response.answers[field.id] ?? "—"
                return (
                  <DetailRow key={field.id} label={label} value={String(answer)} />
                )
              })
            ) : (
              // Fallback: show raw answers if form fields not included
              Object.entries(response.answers).map(([key, value]) => (
                <DetailRow key={key} label={key} value={String(value)} />
              ))
            )}
          </DetailSection>
        )
      })}
    </>
  )
}
