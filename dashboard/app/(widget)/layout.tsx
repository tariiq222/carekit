import type { ReactNode } from "react"

export default function WidgetLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-4xl">
        {children}
      </div>
    </div>
  )
}
