"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

import { useBranches } from "@/hooks/use-branches"
import { useSetServiceBranches, useClearServiceBranches } from "@/hooks/use-services"
import { useLocale } from "@/components/locale-provider"

/* ─── Props ─── */

interface ServiceBranchesTabProps {
  serviceId: string | undefined
  serviceBranches: { branchId: string }[] | undefined
}

/* ─── Component ─── */

export function ServiceBranchesTab({ serviceId, serviceBranches }: ServiceBranchesTabProps) {
  const { t, locale } = useLocale()
  const { branches, isLoading: branchesLoading } = useBranches()
  const setMut = useSetServiceBranches(serviceId ?? "")
  const clearMut = useClearServiceBranches(serviceId ?? "")

  const restrictedIds = (serviceBranches ?? []).map((b) => b.branchId)

  const [selectedMode, setSelectedMode] = useState<"all" | "specific">(
    restrictedIds.length === 0 ? "all" : "specific",
  )
  const [selectedIds, setSelectedIds] = useState<string[]>(restrictedIds)

  // Sync when service data loads
  useEffect(() => {
    if (serviceBranches !== undefined) {
      const ids = serviceBranches.map((b) => b.branchId)
      setSelectedMode(ids.length === 0 ? "all" : "specific")
      setSelectedIds(ids)
    }
  }, [serviceBranches])

  // Create mode — no serviceId yet
  if (!serviceId) {
    return (
      <div className="rounded-lg border border-border bg-surface-muted p-6 flex flex-col gap-3">
        <p className="text-sm font-semibold text-foreground">{t("services.branches.title")}</p>
        <p className="text-sm text-muted-foreground">{t("services.branches.createHint")}</p>
      </div>
    )
  }

  const handleModeChange = async (value: "all" | "specific") => {
    const prev = selectedMode
    setSelectedMode(value)

    if (value === "all") {
      try {
        await clearMut.mutateAsync()
        setSelectedIds([])
        toast.success(t("services.branches.saveSuccess"))
      } catch {
        toast.error(t("services.branches.saveError"))
        setSelectedMode(prev) // revert
      }
    }
  }

  const handleBranchToggle = async (branchId: string, checked: boolean) => {
    const prev = selectedIds
    const next = checked
      ? [...selectedIds, branchId]
      : selectedIds.filter((id) => id !== branchId)

    setSelectedIds(next)

    try {
      await setMut.mutateAsync({ branchIds: next })
      toast.success(t("services.branches.saveSuccess"))
    } catch {
      toast.error(t("services.branches.saveError"))
      setSelectedIds(prev) // revert
    }
  }

  const isMutating = setMut.isPending || clearMut.isPending

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm font-semibold text-foreground">{t("services.branches.title")}</p>

      {/* Mode selection */}
      <RadioGroup
        value={selectedMode}
        onValueChange={(value) => handleModeChange(value as "all" | "specific")}
        disabled={isMutating}
      >
        <div className="flex items-center gap-3">
          <RadioGroupItem value="all" id="branches-all" />
          <Label htmlFor="branches-all" className="cursor-pointer text-sm">
            {t("services.branches.allBranchesLabel")}
          </Label>
        </div>
        <div className="flex items-center gap-3">
          <RadioGroupItem value="specific" id="branches-specific" />
          <Label htmlFor="branches-specific" className="cursor-pointer text-sm">
            {t("services.branches.specificLabel")}
          </Label>
        </div>
      </RadioGroup>

      {/* Branch checklist */}
      {selectedMode === "specific" && (
        <div className="rounded-lg border border-border p-4 flex flex-col gap-3">
          {branchesLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded" />
            ))
          ) : branches.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("services.branches.noBranches")}</p>
          ) : (
            branches.map((branch) => (
              <div key={branch.id} className="flex items-center gap-3">
                <Checkbox
                  id={`branch-${branch.id}`}
                  checked={selectedIds.includes(branch.id)}
                  onCheckedChange={(checked) => handleBranchToggle(branch.id, !!checked)}
                  disabled={isMutating}
                />
                <Label htmlFor={`branch-${branch.id}`} className="cursor-pointer text-sm">
                  {locale === "ar" ? branch.nameAr : branch.nameEn}
                </Label>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
