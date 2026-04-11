"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  GridIcon,
  Menu02Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useLocale } from "@/components/locale-provider"

export type ViewMode = "grid" | "list"

interface Specialty {
  id: string
  nameAr: string
  nameEn: string
}

interface PractitionersFilterBarProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  specialties: Specialty[]
  selectedSpecialty: string | undefined
  onSpecialtyChange: (id: string | undefined) => void
  selectedStatus: string | undefined
  onStatusChange: (status: string | undefined) => void
  onReset: () => void
  hasFilters: boolean
}

export function PractitionersFilterBar({
  viewMode,
  onViewModeChange,
  specialties,
  selectedSpecialty,
  onSpecialtyChange,
  selectedStatus,
  onStatusChange,
  onReset,
  hasFilters,
}: PractitionersFilterBarProps) {
  const { t, locale } = useLocale()

  return (
    <Card className="flex flex-row items-center justify-between gap-4 p-4">
      {/* Filters (start side in RTL = right visual side) */}
      <div className="flex items-center gap-3">
        {/* Specialty Filter */}
        <Select
          value={selectedSpecialty ?? "all"}
          onValueChange={(v) => onSpecialtyChange(v === "all" ? undefined : v)}
        >
          <SelectTrigger className="h-9 w-[160px] text-sm">
            <SelectValue placeholder={t("practitioners.filters.specialty")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t("practitioners.filters.allSpecialties")}
            </SelectItem>
            {specialties.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {locale === "ar" ? s.nameAr : s.nameEn}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select
          value={selectedStatus ?? "all"}
          onValueChange={(v) => onStatusChange(v === "all" ? undefined : v)}
        >
          <SelectTrigger className="h-9 w-[140px] text-sm">
            <SelectValue placeholder={t("practitioners.filters.status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t("practitioners.filters.allStatuses")}
            </SelectItem>
            <SelectItem value="active">
              {t("practitioners.card.active")}
            </SelectItem>
            <SelectItem value="inactive">
              {t("practitioners.card.inactive")}
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Reset */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={onReset}
          >
            <HugeiconsIcon icon={Cancel01Icon} size={14} />
            {t("practitioners.filters.reset")}
          </Button>
        )}
      </div>

      {/* View Toggle (end side in RTL = left visual side) */}
      <div className="flex items-center gap-1 rounded-md bg-muted/50 p-1">
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn(
            viewMode === "grid" &&
              "bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground"
          )}
          onClick={() => onViewModeChange("grid")}
        >
          <HugeiconsIcon icon={GridIcon} size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn(
            viewMode === "list" &&
              "bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground"
          )}
          onClick={() => onViewModeChange("list")}
        >
          <HugeiconsIcon icon={Menu02Icon} size={16} />
        </Button>
      </div>
    </Card>
  )
}
