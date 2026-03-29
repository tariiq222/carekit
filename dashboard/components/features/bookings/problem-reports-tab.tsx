"use client"

import { useState } from "react"
import { ErrorBanner } from "@/components/features/error-banner"
import { format } from "date-fns"

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
import { Alert02Icon } from "@hugeicons/core-free-icons"
import { useProblemReports } from "@/hooks/use-problem-reports"
import { ResolveDialog } from "@/components/features/problem-reports/resolve-dialog"
import { useLocale } from "@/components/locale-provider"
import type { ProblemReportStatus } from "@/lib/types/problem-report"

const statusStyles: Record<
  ProblemReportStatus,
  { labelKey: string; className: string }
> = {
  open: {
    labelKey: "problemReports.status.open",
    className: "border-warning/20 bg-warning/10 text-warning",
  },
  in_review: {
    labelKey: "problemReports.status.inReview",
    className: "border-info/20 bg-info/10 text-info",
  },
  resolved: {
    labelKey: "problemReports.status.resolved",
    className: "border-success/20 bg-success/10 text-success",
  },
  dismissed: {
    labelKey: "problemReports.status.dismissed",
    className: "border-muted-foreground/20 bg-muted text-muted-foreground",
  },
}

const TYPE_LABEL_KEYS: Record<string, string> = {
  wait_time: "problemReports.type.waitTime",
  staff_behavior: "problemReports.type.staffBehavior",
  cleanliness: "problemReports.type.cleanliness",
  billing: "problemReports.type.billing",
  no_call: "problemReports.type.noCall",
  late: "problemReports.type.late",
  technical: "problemReports.type.technical",
  other: "problemReports.type.other",
}

export function ProblemReportsTab() {
  const { t } = useLocale()
  const {
    reports,
    meta,
    isLoading,
    error,
    page,
    setPage,
    status,
    setStatus,
    resetFilters,
  } = useProblemReports()

  const [resolveId, setResolveId] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={status ?? "all"}
          onValueChange={(v) =>
            setStatus(v === "all" ? undefined : (v as ProblemReportStatus))
          }
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder={t("problemReports.allStatuses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("problemReports.allStatuses")}</SelectItem>
            <SelectItem value="open">{t("problemReports.status.open")}</SelectItem>
            <SelectItem value="in_review">{t("problemReports.status.inReview")}</SelectItem>
            <SelectItem value="resolved">{t("problemReports.status.resolved")}</SelectItem>
            <SelectItem value="dismissed">{t("problemReports.status.dismissed")}</SelectItem>
          </SelectContent>
        </Select>

        {status && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            {t("problemReports.clear")}
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
      ) : reports.length === 0 ? (
        <EmptyState
          icon={Alert02Icon}
          title={t("problemReports.empty.title")}
          description={t("problemReports.empty.description")}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((r) => {
            const st = statusStyles[r.status] ?? statusStyles.open
            return (
              <div
                key={r.id}
                className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={st.className}>
                        {t(st.labelKey)}
                      </Badge>
                      <Badge variant="outline">
                        {TYPE_LABEL_KEYS[r.type] ? t(TYPE_LABEL_KEYS[r.type]) : r.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground">{r.description}</p>
                  </div>
                  {(r.status === "open" || r.status === "in_review") && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => setResolveId(r.id)}
                    >
                      {t("problemReports.resolve")}
                    </Button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  {r.patient && (
                    <span>
                      {t("problemReports.patient")}: {r.patient.firstName} {r.patient.lastName}
                    </span>
                  )}
                  {r.booking && (
                    <span className="tabular-nums">
                      {t("problemReports.booking")}: {format(new Date(r.booking.date), "MMM d, yyyy")}
                    </span>
                  )}
                  <span className="tabular-nums">
                    {t("problemReports.reported")}: {format(new Date(r.createdAt), "MMM d, yyyy")}
                  </span>
                  {r.resolvedBy && (
                    <span>
                      {t("problemReports.resolvedBy")}: {r.resolvedBy.firstName}{" "}
                      {r.resolvedBy.lastName}
                    </span>
                  )}
                </div>

                {r.adminNotes && (
                  <p className="text-xs italic text-muted-foreground">
                    {t("problemReports.notes")}: {r.adminNotes}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={!meta.hasPreviousPage}
            onClick={() => setPage(page - 1)}
          >
            {t("table.previous")}
          </Button>
          <span className="text-xs tabular-nums text-muted-foreground">
            {t("table.page")} {meta.page} {t("table.of")} {meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!meta.hasNextPage}
            onClick={() => setPage(page + 1)}
          >
            {t("table.next")}
          </Button>
        </div>
      )}

      {/* Resolve dialog */}
      <ResolveDialog
        reportId={resolveId}
        open={!!resolveId}
        onOpenChange={(o) => !o && setResolveId(null)}
      />
    </div>
  )
}
