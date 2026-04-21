"use client"

import { ErrorBanner } from "@/components/features/error-banner"
import { EmptyState } from "@/components/features/empty-state"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@carekit/ui"
import { Clock01Icon } from "@hugeicons/core-free-icons"
import { useWaitlistMutations } from "@/hooks/use-waitlist"
import { useFeatureFlagMap } from "@/hooks/use-feature-flags"
import { useLocale } from "@/components/locale-provider"
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

export function WaitlistTab() {
  const { t } = useLocale()
  const { isEnabled } = useFeatureFlagMap()

  if (!isEnabled("waitlist")) return null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Select value="all" onValueChange={() => {}} disabled>
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
      </div>

      <EmptyState
        icon={Clock01Icon}
        title={t("waitlist.empty.title")}
        description={t("waitlist.empty.description")}
      />
    </div>
  )
}
