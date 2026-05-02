// EXCEPTION: ZATCA onboarding flow + config + status share mutations; splitting would scatter regulated business logic, approved 2026-04-24
"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Card, CardContent } from "@deqah/ui"
import { Badge } from "@deqah/ui"
import { Button } from "@deqah/ui"
import { Input } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { Skeleton } from "@deqah/ui"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@deqah/ui"

import {
  useZatcaConfig,
  useOnboardingStatus,
  useZatcaMutations,
} from "@/hooks/use-zatca"
import { useLocale } from "@/components/locale-provider"
import { formatLocaleDate } from "@/lib/date"
import {
  zatcaOnboardSchema,
  type ZatcaOnboardFormData,
} from "@/lib/schemas/invoice.schema"

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground tabular-nums">{value}</span>
    </div>
  )
}

export function ZatcaTab() {
  const { t, locale } = useLocale()
  const { data: config, isLoading: configLoading } = useZatcaConfig()
  const { data: status, isLoading: statusLoading } = useOnboardingStatus()
  const { onboardMut } = useZatcaMutations()
  const [onboardOpen, setOnboardOpen] = useState(false)

  const form = useForm<ZatcaOnboardFormData>({
    resolver: zodResolver(zatcaOnboardSchema),
    defaultValues: { vatRegistrationNumber: "", sellerName: "" },
  })

  const handleOnboard = form.handleSubmit(async (data) => {
    try {
      await onboardMut.mutateAsync(data)
      toast.success(t("zatca.onboardSuccess"))
      form.reset()
      setOnboardOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("zatca.onboardError"))
    }
  })

  const isLoading = configLoading || statusLoading

  return (
    <div className="flex flex-col gap-4">
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      )}

      {/* Combined Configuration + Status Card */}
      <Card>
        <CardContent className="flex flex-col gap-5 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="text-base font-semibold text-foreground">{t("zatca.zakatLinkTitle")}</h4>
              <p className="mt-0.5 text-sm text-muted-foreground">{t("zatca.zakatLinkDesc")}</p>
            </div>
            <Badge
              variant="outline"
              className={
                status?.isOnboarded
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              }
            >
              {status?.isOnboarded ? t("zatca.linkedStatus") : t("zatca.notLinkedStatus")}
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="bg-surface shadow-sm">
              <CardContent className="pt-3 pb-3">
                <InfoRow label={t("zatca.vatNumber")} value={config?.vatRegistrationNumber ?? "—"} />
              </CardContent>
            </Card>
            <Card className="bg-surface shadow-sm">
              <CardContent className="pt-3 pb-3">
                <InfoRow label={t("zatca.orgName")} value={config?.sellerName ?? "—"} />
              </CardContent>
            </Card>
            <Card className="bg-surface shadow-sm">
              <CardContent className="pt-3 pb-3">
                <InfoRow
                  label={t("zatca.environment")}
                  value={
                    <Badge
                      variant="outline"
                      className={
                        config?.environment === "production"
                          ? "border-success/30 bg-success/10 text-success"
                          : "border-warning/30 bg-warning/10 text-warning"
                      }
                    >
                      {config?.environment ?? "sandbox"}
                    </Badge>
                  }
                />
              </CardContent>
            </Card>
            {status?.onboardedAt && (
              <Card className="bg-surface shadow-sm">
                <CardContent className="pt-3 pb-3">
                  <InfoRow
                    label={t("zatca.onboardedAt")}
                    value={formatLocaleDate(status.onboardedAt, locale, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          <div className="flex justify-end">
            <Button size="sm" onClick={() => setOnboardOpen(true)} disabled={config?.isOnboarded}>
              {config?.isOnboarded ? t("zatca.alreadyOnboarded") : t("zatca.startOnboarding")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Onboard Sheet */}
      <Sheet open={onboardOpen} onOpenChange={setOnboardOpen}>
        <SheetContent side="end" className="w-full overflow-y-auto sm:max-w-[45vw]">
          <SheetHeader>
            <SheetTitle>{t("zatca.onboardTitle")}</SheetTitle>
            <SheetDescription>{t("zatca.onboardDesc")}</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleOnboard} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>{t("zatca.vatNumber")} *</Label>
              <Input {...form.register("vatRegistrationNumber")} placeholder={t("zatca.vatPlaceholder")} className="tabular-nums" />
              {form.formState.errors.vatRegistrationNumber && (
                <p className="text-xs text-destructive">{form.formState.errors.vatRegistrationNumber.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t("zatca.orgName")} *</Label>
              <Input {...form.register("sellerName")} placeholder={t("zatca.sellerPlaceholder")} />
              {form.formState.errors.sellerName && (
                <p className="text-xs text-destructive">{form.formState.errors.sellerName.message}</p>
              )}
            </div>
            <SheetFooter>
              <Button type="button" variant="outline" onClick={() => setOnboardOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={onboardMut.isPending}>
                {onboardMut.isPending ? "Processing..." : t("zatca.startOnboarding")}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
