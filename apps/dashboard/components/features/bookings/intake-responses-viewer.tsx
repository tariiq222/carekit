"use client"

import { DetailSection, DetailRow } from "@/components/features/detail-sheet-parts"
import { useLocale } from "@/components/locale-provider"
import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { Badge } from "@deqah/ui"
import { format } from "date-fns"

interface Props {
  bookingId: string
}

export function IntakeResponsesViewer({ bookingId: _bookingId }: Props) {
  const { locale: _locale, t } = useLocale()

  const { data: responses } = useQuery({
    queryKey: queryKeys.intakeForms.responses(_bookingId),
    queryFn: () => Promise.resolve([]),
    enabled: false,
  })

  if (!responses || responses.length === 0) return null

  return (
    <>
      {(responses as unknown[]).map((_, __) => (
        <DetailSection key={__} title={t("detail.intakeForm")}>
          <Badge variant="outline" className="text-[10px]">
            {t("detail.intakeForm")}
          </Badge>
        </DetailSection>
      ))}
    </>
  )
}
