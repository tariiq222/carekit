// EXCEPTION: ZATCA onboarding flow + config + status share mutations; splitting would scatter regulated business logic, approved 2026-04-24
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
import { Card, CardContent } from "@carekit/ui"
import { Badge } from "@carekit/ui"
import { Button } from "@carekit/ui"
import { Input } from "@carekit/ui"
import { Label } from "@carekit/ui"
import { Skeleton } from "@carekit/ui"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@carekit/ui"

import {
  useZatcaConfig,
  useOnboardingStatus,
  useZatcaMutations,
} from "@/hooks/use-zatca"
import { useLocale } from "@/components/locale-provider"
import {
  zatcaOnboardSchema,
  type ZatcaOnboardFormData,
} from "@/lib/schemas/invoice.schema"

type TabId = "config" | "status"

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground tabular-nums">{value}</span>
    </div>
  )
}

export function ZatcaTab() {
  const { t } = useLocale()
  const { data: config, isLoading: configLoading } = useZatcaConfig()
  const { data: status, isLoading: statusLoading } = useOnboardingStatus()
  const { onboardMut } = useZatcaMutations()
  const [onboardOpen, setOnboardOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>("config")

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

  const tabs: { id: TabId; label: string; desc: string }[] = [
    { id: "config", label: t("zatca.config"), desc: t("zatca.configDesc") },
    {
      id: "status",
      label: t("zatca.onboardingStatus"),
      desc: t("zatca.onboardDesc"),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Stats */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : config ? (
        <StatsGrid>
          <StatCard
            title={t("zatca.environment")}
            value={config.environment}
            icon={TimeQuarterPassIcon}
            iconColor="primary"
          />
          <StatCard
            title={t("zatca.onboarded")}
            value={config.isOnboarded ? t("common.yes") : t("common.no")}
            icon={CheckmarkCircle02Icon}
            iconColor={config.isOnboarded ? "success" : "warning"}
          />
          <StatCard
            title={t("zatca.vatNumber")}
            value={config.vatRegistrationNumber ?? "—"}
            icon={Alert02Icon}
            iconColor="warning"
          />
          <StatCard
            title={t("zatca.seller")}
            value={config.sellerName ?? "—"}
            icon={Cancel01Icon}
            iconColor="primary"
          />
        </StatsGrid>
      ) : null}

      {/* Sidebar Layout */}
      <Card className="overflow-hidden p-0">
        <div className="flex min-h-[360px]">
          {/* ── Sidebar ── */}
          <div className="flex w-64 shrink-0 flex-col border-e border-border bg-surface-muted">
            <div className="border-b border-border px-4 py-3">
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {t("invoices.tabs.zatca")}
              </p>
            </div>
            <div role="tablist" className="flex-1 space-y-1.5 p-3">
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  tabIndex={0}
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setActiveTab(tab.id)
                  }}
                  className={cn(
                    "w-full cursor-pointer rounded-lg px-3 py-2.5 transition-all select-none",
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                  )}
                >
                  <p className="truncate text-sm leading-tight font-medium">
                    {tab.label}
                  </p>
                  {activeTab === tab.id && (
                    <p className="mt-0.5 line-clamp-2 text-xs leading-tight opacity-80">
                      {tab.desc}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Content ── */}
          <div className="flex flex-1 flex-col overflow-y-auto bg-surface-muted/50 p-5">
            {activeTab === "config" && (
              <div className="flex h-full flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <Card className="bg-surface shadow-sm">
                    <CardContent className="pt-3 pb-3">
                      <InfoRow
                        label={t("zatca.vatNumber")}
                        value={config?.vatRegistrationNumber ?? "—"}
                      />
                    </CardContent>
                  </Card>
                  <Card className="bg-surface shadow-sm">
                    <CardContent className="pt-3 pb-3">
                      <InfoRow
                        label={t("zatca.orgName")}
                        value={config?.sellerName ?? "—"}
                      />
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
                </div>
                <div className="mt-auto flex justify-end pt-2">
                  <Button
                    size="sm"
                    onClick={() => setOnboardOpen(true)}
                    disabled={config?.isOnboarded}
                  >
                    {config?.isOnboarded
                      ? t("zatca.alreadyOnboarded")
                      : t("zatca.startOnboarding")}
                  </Button>
                </div>
              </div>
            )}

            {activeTab === "status" && (
              <div className="flex h-full flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <Card className="bg-surface shadow-sm">
                    <CardContent className="pt-3 pb-3">
                      <InfoRow
                        label={t("zatca.onboarded")}
                        value={
                          <Badge
                            variant="outline"
                            className={
                              status?.isOnboarded
                                ? "border-success/30 bg-success/10 text-success"
                                : "border-destructive/30 bg-destructive/10 text-destructive"
                            }
                          >
                            {status?.isOnboarded
                              ? t("common.yes")
                              : t("common.no")}
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
                          value={new Date(
                            status.onboardedAt
                          ).toLocaleDateString("ar-SA", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        />
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Onboard Sheet */}
      <Sheet open={onboardOpen} onOpenChange={setOnboardOpen}>
        <SheetContent
          side="end"
          className="w-full overflow-y-auto sm:max-w-[45vw]"
        >
          <SheetHeader>
            <SheetTitle>{t("zatca.onboardTitle")}</SheetTitle>
            <SheetDescription>{t("zatca.onboardDesc")}</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleOnboard} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>{t("zatca.vatNumber")} *</Label>
              <Input
                {...form.register("vatRegistrationNumber")}
                placeholder={t("zatca.vatPlaceholder")}
                className="tabular-nums"
              />
              {form.formState.errors.vatRegistrationNumber && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.vatRegistrationNumber.message}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t("zatca.orgName")} *</Label>
              <Input
                {...form.register("sellerName")}
                placeholder={t("zatca.sellerPlaceholder")}
              />
              {form.formState.errors.sellerName && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.sellerName.message}
                </p>
              )}
            </div>
            <SheetFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOnboardOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={onboardMut.isPending}>
                {onboardMut.isPending
                  ? "Processing..."
                  : t("zatca.startOnboarding")}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
