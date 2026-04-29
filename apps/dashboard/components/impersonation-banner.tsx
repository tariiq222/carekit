"use client"

import { useSyncExternalStore } from "react"
import { Button } from "@carekit/ui"
import { useLocale } from "@/components/locale-provider"
import { useAuth } from "@/components/providers/auth-provider"
import { clearImpersonationMarker, isImpersonating } from "@/lib/api/auth"

function subscribeToImpersonationStore() {
  return () => undefined
}

export function ImpersonationBanner() {
  const { t } = useLocale()
  const { logout } = useAuth()
  const visible = useSyncExternalStore(
    subscribeToImpersonationStore,
    isImpersonating,
    () => false,
  )

  if (!visible) return null

  const endSession = async () => {
    await logout()
    clearImpersonationMarker()
    window.location.href = "/"
  }

  return (
    <div className="flex min-h-10 items-center justify-between gap-3 border-b border-warning/30 bg-warning/12 px-4 py-2 text-warning-foreground md:px-8">
      <p className="text-sm font-medium">{t("impersonation.banner")}</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={endSession}
        className="h-8 border-warning/40 bg-background/70 text-warning-foreground hover:bg-warning/18"
      >
        {t("impersonation.endSession")}
      </Button>
    </div>
  )
}
