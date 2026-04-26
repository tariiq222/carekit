"use client"

import { BillingProvider } from "@/lib/billing/billing-context"

export function BillingShell({ children }: { children: React.ReactNode }) {
  return <BillingProvider>{children}</BillingProvider>
}
