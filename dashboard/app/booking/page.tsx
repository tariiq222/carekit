import { Suspense } from "react"
import { BookingWizard } from "@/components/features/widget/booking-wizard"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon } from "@hugeicons/core-free-icons"

interface PageProps {
  searchParams: Promise<{
    practitioner?: string
    service?: string
    locale?: string
    type?: string
    origin?: string
  }>
}

export default async function WidgetBookPage({ searchParams }: PageProps) {
  const params = await searchParams

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <HugeiconsIcon icon={Loading03Icon} size={32} className="text-primary" />
        </div>
      }
    >
      <BookingWizard
        initialPractitionerId={params.practitioner}
        initialServiceId={params.service}
        initialLocale={(params.locale as "ar" | "en") ?? "ar"}
        parentOrigin={params.origin}
      />
    </Suspense>
  )
}
