import { AppSidebar } from "@/components/app-sidebar"
import { Header } from "@/components/header"
import { MobileSidebarTrigger } from "@/components/mobile-sidebar-trigger"
import { SidebarInset, SidebarProvider } from "@carekit/ui"
import { AuthGate } from "@/components/providers/auth-gate"
import { CommandPalette } from "@/components/features/command-palette"
import { BillingProvider } from "@/lib/billing/billing-context"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGate>
      <BillingProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="min-h-0 relative z-[1]">
            <Header />
            <div className="flex-1 overflow-y-auto p-4 md:px-8 md:py-7">
              {children}
            </div>
            <CommandPalette />
          </SidebarInset>
          <MobileSidebarTrigger />
        </SidebarProvider>
      </BillingProvider>
    </AuthGate>
  )
}
