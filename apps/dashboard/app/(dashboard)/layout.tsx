"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { Header } from "@/components/header"
import { MobileSidebarTrigger } from "@/components/mobile-sidebar-trigger"
import { SidebarInset, SidebarProvider } from "@carekit/ui"
import { AuthGate } from "@/components/providers/auth-gate"
import { CommandPalette } from "@/components/features/command-palette"
import { BillingShell } from "@/components/billing-shell"
import { TrialBanner } from "@/components/trial-banner"
import { useAuth } from "@/components/providers/auth-provider"

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user && !(user as unknown as { onboardingCompletedAt?: string | null }).onboardingCompletedAt) {
      router.replace("/onboarding")
    }
  }, [user, router])

  return <>{children}</>
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGate>
      <OnboardingGuard>
        <BillingShell>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="min-h-0 relative z-[1]">
              <Header />
              <TrialBanner />
              <div className="flex-1 overflow-y-auto p-4 md:px-8 md:py-7">
                {children}
              </div>
              <CommandPalette />
            </SidebarInset>
            <MobileSidebarTrigger />
          </SidebarProvider>
        </BillingShell>
      </OnboardingGuard>
    </AuthGate>
  )
}
