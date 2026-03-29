"use client"

import { ErrorBanner } from "@/components/features/error-banner"
import { EmptyState } from "@/components/features/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Clock01Icon, Delete02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useWaitlist, useWaitlistMutations } from "@/hooks/use-waitlist"
import { useLocale } from "@/components/locale-provider"
import { toast } from "sonner"
import { format } from "date-fns"
import type { WaitlistStatus } from "@/lib/types/waitlist"

const statusStyles: Record<
  WaitlistStatus,
  { labelKey: string; className: string }
> = {
  waiting: {
    labelKey: "waitlist.status.waiting",
    className: "border-warning/20 bg-warning/10 text-warning",
  },
  notified: {
    labelKey: "waitlist.status.notified",
    className: "border-info/20 bg-info/10 text-info",
  },
  booked: {
    labelKey: "waitlist.status.booked",
    className: "border-success/20 bg-success/10 text-success",
  },
  expired: {
    labelKey: "waitlist.status.expired",
    className: "border-muted-foreground/20 bg-muted text-muted-foreground",
  },
  cancelled: {
    labelKey: "waitlist.status.cancelled",
    className: "border-muted-foreground/20 bg-muted text-muted-foreground",
  },
}

const timeLabels: Record<string, string> = {
  morning: "waitlist.time.morning",
  afternoon: "waitlist.time.afternoon",
  any: "waitlist.time.any",
}

export function WaitlistTab() {
  const { t, locale } = useLocale()
  const {
    entries,
    isLoading,
    error,
    status,
    setStatus,
    resetFilters,
    refetch,
  } = useWaitlist()
  const { removeMut } = useWaitlistMutations()

  const handleRemove = (id: string) => {
    removeMut.mutate(id, {
      onSuccess: () => {
        toast.success(t("waitlist.removed"))
        refetch()
      },
      onError: () => toast.error(t("waitlist.removeError")),
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={status ?? "all"}
          onValueChange={(v) =>
            setStatus(v === "all" ? undefined : (v as WaitlistStatus))
          }
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder={t("waitlist.allStatuses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("waitlist.allStatuses")}</SelectItem>
            <SelectItem value="waiting">{t("waitlist.status.waiting")}</SelectItem>
            <SelectItem value="notified">{t("waitlist.status.notified")}</SelectItem>
            <SelectItem value="booked">{t("waitlist.status.booked")}</SelectItem>
            <SelectItem value="expired">{t("waitlist.status.expired")}</SelectItem>
            <SelectItem value="cancelled">{t("waitlist.status.cancelled")}</SelectItem>
          </SelectContent>
        </Select>

        {status && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            {t("waitlist.clear")}
          </Button>
        )}
      </div>

      {/* Error */}
      {error && <ErrorBanner message={error} />}

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={Clock01Icon}
          title={t("waitlist.empty.title")}
          description={t("waitlist.empty.description")}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => {
            const st = statusStyles[entry.status] ?? statusStyles.waiting
            const doctorName = `${entry.practitioner.user.firstName} ${entry.practitioner.user.lastName}`
            const patientName = `${entry.patient.firstName} ${entry.patient.lastName}`
            const serviceName = entry.service
              ? locale === "ar" ? entry.service.nameAr : entry.service.nameEn
              : null

            return (
              <div
                key={entry.id}
                className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={st.className}>
                        {t(st.labelKey)}
                      </Badge>
                      {serviceName && (
                        <Badge variant="outline">{serviceName}</Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {patientName}
                    </p>
                  </div>
                  {entry.status === "waiting" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-error"
                      onClick={() => handleRemove(entry.id)}
                      disabled={removeMut.isPending}
                      aria-label="Remove from waitlist"
                    >
                      <HugeiconsIcon icon={Delete02Icon} size={16} />
                    </Button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <span>
                    {t("waitlist.doctor")}: {doctorName}
                  </span>
                  {entry.preferredDate && (
                    <span className="tabular-nums">
                      {t("waitlist.preferredDate")}:{" "}
                      {format(new Date(entry.preferredDate), "MMM d, yyyy")}
                    </span>
                  )}
                  {entry.preferredTime && (
                    <span>
                      {t("waitlist.preferredTime")}:{" "}
                      {t(timeLabels[entry.preferredTime] ?? entry.preferredTime)}
                    </span>
                  )}
                  <span className="tabular-nums">
                    {t("waitlist.joined")}:{" "}
                    {format(new Date(entry.createdAt), "MMM d, yyyy")}
                  </span>
                  {entry.notifiedAt && (
                    <span className="tabular-nums">
                      {t("waitlist.notifiedAt")}:{" "}
                      {format(new Date(entry.notifiedAt), "MMM d, yyyy HH:mm")}
                    </span>
                  )}
                </div>

                {entry.patient.phone && (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {t("waitlist.phone")}: {entry.patient.phone}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
