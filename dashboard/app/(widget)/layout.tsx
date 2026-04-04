import type { ReactNode } from "react"

/**
 * Widget Layout — minimal shell, no extra wrappers.
 * The BookingWizard itself handles its own sizing and centering.
 */
export default function WidgetLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-4xl">
        {children}
      </div>
    </div>
  )
}
