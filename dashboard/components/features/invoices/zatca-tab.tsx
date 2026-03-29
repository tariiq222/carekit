"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import {
  CheckmarkCircle02Icon,
  Cancel01Icon,
  TimeQuarterPassIcon,
  Alert02Icon,
} from "@hugeicons/core-free-icons"

import { StatsGrid } from "@/components/features/stats-grid"
import { StatCard } from "@/components/features/stat-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"

import { useZatcaConfig, useOnboardingStatus, useSandboxStats, useZatcaMutations } from "@/hooks/use-zatca"
import { useLocale } from "@/components/locale-provider"
import { zatcaOtpSchema, type ZatcaOtpFormData } from "@/lib/schemas/invoice.schema"

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-foreground">{value}</span>
    </div>
  )
}

export function ZatcaTab() {
  const { t } = useLocale()
  const { data: config, isLoading: configLoading } = useZatcaConfig()
  const { data: status, isLoading: statusLoading } = useOnboardingStatus()
  const { data: sandbox, isLoading: sandboxLoading } = useSandboxStats()
  const { onboardMut } = useZatcaMutations()
  const [onboardOpen, setOnboardOpen] = useState(false)

  const form = useForm<ZatcaOtpFormData>({
    resolver: zodResolver(zatcaOtpSchema),
    defaultValues: { otp: "" },
  })

  const handleOnboard = form.handleSubmit(async (data) => {
    try {
      await onboardMut.mutateAsync(data)
      toast.success(t("zatca.onboardSuccess"))
      form.reset()
      setOnboardOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Onboarding failed")
    }
  })

  const isLoading = configLoading || statusLoading || sandboxLoading

  return (
    <div className="flex flex-col gap-6">
      {/* Action */}
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOnboardOpen(true)}>
          {t("zatca.startOnboarding")}
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          {/* Sandbox Stats */}
          {sandbox && (
            <StatsGrid>
              <StatCard
                title={t("zatca.totalReported")}
                value={sandbox.totalReported}
                icon={TimeQuarterPassIcon}
                iconColor="primary"
              />
              <StatCard
                title={t("zatca.accepted")}
                value={sandbox.accepted}
                icon={CheckmarkCircle02Icon}
                iconColor="success"
              />
              <StatCard
                title={t("zatca.rejected")}
                value={sandbox.rejected}
                icon={Cancel01Icon}
                iconColor="warning"
              />
              <StatCard
                title={t("zatca.warnings")}
                value={sandbox.warnings}
                icon={Alert02Icon}
                iconColor="warning"
              />
            </StatsGrid>
          )}

          {/* Config & Status */}
          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("zatca.config")}</CardTitle>
                <CardDescription>{t("zatca.configDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Row label={t("zatca.vatNumber")} value={config?.vatNumber ?? "—"} />
                <Row label={t("zatca.orgName")} value={config?.organizationName ?? "—"} />
                <Row
                  label={t("zatca.phase")}
                  value={
                    <Badge
                      variant="outline"
                      className={
                        config?.phase === "production"
                          ? "border-success/30 bg-success/10 text-success"
                          : config?.phase === "compliance"
                            ? "border-warning/30 bg-warning/10 text-warning"
                            : "border-muted-foreground/30 bg-muted text-muted-foreground"
                      }
                    >
                      {config?.phase ?? "none"}
                    </Badge>
                  }
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("zatca.onboardingStatus")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Row
                  label={t("zatca.complianceCsid")}
                  value={
                    <Badge variant="outline" className={status?.hasComplianceCsid ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/10 text-destructive"}>
                      {status?.hasComplianceCsid ? "Active" : "Missing"}
                    </Badge>
                  }
                />
                <Row
                  label={t("zatca.productionCsid")}
                  value={
                    <Badge variant="outline" className={status?.hasProductionCsid ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/10 text-destructive"}>
                      {status?.hasProductionCsid ? "Active" : "Missing"}
                    </Badge>
                  }
                />
                {status?.complianceCsidExpiry && (
                  <Row label={t("zatca.csidExpiry")} value={new Date(status.complianceCsidExpiry).toLocaleDateString()} />
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Onboard Sheet */}
      <Sheet open={onboardOpen} onOpenChange={setOnboardOpen}>
        <SheetContent side="end" className="overflow-y-auto w-full sm:max-w-[45vw]">
          <SheetHeader>
            <SheetTitle>{t("zatca.onboardTitle")}</SheetTitle>
            <SheetDescription>{t("zatca.onboardDesc")}</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleOnboard} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>OTP *</Label>
              <Input {...form.register("otp")} placeholder={t("zatca.otpPlaceholder")} className="tabular-nums" />
              {form.formState.errors.otp && (
                <p className="text-xs text-destructive">{form.formState.errors.otp.message}</p>
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
