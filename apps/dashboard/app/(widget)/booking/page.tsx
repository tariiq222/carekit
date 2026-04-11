import { Suspense } from "react"
import { BookingWizard } from "@/components/features/widget/booking-wizard"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon } from "@hugeicons/core-free-icons"
import { fetchBookingFlowOrder, type BookingFlowOrder } from "@/lib/api/organization-settings"

interface PageProps {
  searchParams: Promise<{
    employee?: string
    service?: string
    locale?: string
    origin?: string
    flow?: string
  }>
}

export default async function WidgetBookingPage({ searchParams }: PageProps) {
  const params = await searchParams

  const locale = (params.locale as "ar" | "en") ?? "ar"
  const parentOrigin = params.origin ?? ""

  // URL param overrides DB — allows embed.js to force a specific flow per embed
  let flowOrder: BookingFlowOrder = "service_first"
  if (
    params.flow === "service_first" ||
    params.flow === "employee_first" ||
    params.flow === "both"
  ) {
    flowOrder = params.flow
  } else {
    try {
      flowOrder = await fetchBookingFlowOrder()
    } catch {
      // keep default
    }
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <HugeiconsIcon icon={Loading03Icon} size={32} className="animate-spin text-primary" />
        </div>
      }
    >
      <BookingWizard
        initialEmployeeId={params.employee}
        initialServiceId={params.service}
        initialLocale={locale}
        parentOrigin={parentOrigin}
        initialFlowOrder={flowOrder}
      />
    </Suspense>
  )
}
