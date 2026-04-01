import { Suspense } from "react"
import { BookingWizard } from "@/components/features/widget/booking-wizard"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon } from "@hugeicons/core-free-icons"
import { fetchBookingFlowOrder, type BookingFlowOrder } from "@/lib/api/clinic-settings"

interface PageProps {
  searchParams: Promise<{
    practitioner?: string
    service?: string
    locale?: string
    type?: string
    origin?: string
    flow?: string
  }>
}

export default async function WidgetBookPage({ searchParams }: PageProps) {
  const params = await searchParams

  // URL param takes priority; fall back to DB setting
  let flowOrder: BookingFlowOrder = "service_first"
  if (params.flow === "service_first" || params.flow === "practitioner_first") {
    flowOrder = params.flow
  } else {
    try {
      flowOrder = await fetchBookingFlowOrder()
    } catch {
      // keep default
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-4xl">
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
            initialFlowOrder={flowOrder}
          />
        </Suspense>
      </div>
    </div>
  )
}
