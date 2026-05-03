"use client"

import { Skeleton } from "@deqah/ui"
import { useBranding, useUpdateBranding } from "@/hooks/use-branding"
import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/locale-provider"
import { BrandingForm } from "@/components/features/branding/branding-form"
import type { UpdateBrandingPayload } from "@/lib/types/branding"

export function BrandingTab() {
  const { t } = useLocale()
  const { canDo } = useAuth()
  const { data: branding, isLoading } = useBranding()
  const mutation = useUpdateBranding()

  if (!canDo("branding", "edit")) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg font-medium text-muted-foreground">{t("common.noPermission")}</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full sm:w-96" />
        <Skeleton className="h-[300px] rounded-lg" />
      </div>
    )
  }

  const handleSave = (data: UpdateBrandingPayload) => {
    mutation.mutate(data)
  }

  return (
    <BrandingForm
      branding={branding ?? null}
      onSave={handleSave}
      isPending={mutation.isPending}
    />
  )
}
