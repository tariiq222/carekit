"use client"

import { useEffect } from "react"
import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { Header } from "@/components/header"
import { MobileSidebarTrigger } from "@/components/mobile-sidebar-trigger"
import { SidebarInset, SidebarProvider } from "@deqah/ui"
import { AuthGate } from "@/components/providers/auth-gate"
import { CommandPalette } from "@/components/features/command-palette"
import { BillingShell } from "@/components/billing-shell"
import { ImpersonationBanner } from "@/components/impersonation-banner"
import { TrialBanner } from "@/components/trial-banner"
import { useAuth } from "@/components/providers/auth-provider"

type OnboardingAwareUser = {
  onboardingCompletedAt?: string | null
  isSuperAdmin?: boolean
}

function OnboardingGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    const authUser = user as unknown as OnboardingAwareUser | null
    if (authUser && !authUser.isSuperAdmin && authUser.onboardingCompletedAt === null) {
      router.replace("/onboarding")
    }
  }, [user, router])

  return <>{children}</>
}

export default function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <AuthGate>
      <OnboardingGuard>
        <BillingShell>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="min-h-0 relative z-[1]">
              <Header />
              <ImpersonationBanner />
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
