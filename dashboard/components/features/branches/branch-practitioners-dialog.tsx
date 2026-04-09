"use client"

import { useState, useMemo } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete02Icon, Search01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogBody,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

import {
  useBranchPractitioners,
  useBranchPractitionerMutations,
} from "@/hooks/use-branches"
import { useLocale } from "@/components/locale-provider"
import { fetchPractitioners } from "@/lib/api/practitioners"
import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import type { Branch } from "@/lib/types/branch"

interface Props {
  branch: Branch | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BranchPractitionersDialog({ branch, open, onOpenChange }: Props) {
  const { t, locale } = useLocale()
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<string[]>([])

  const branchId = branch?.id ?? null
  const branchName = branch ? (locale === "ar" ? branch.nameAr : branch.nameEn) : ""

  const { data: assigned, isLoading: loadingAssigned } = useBranchPractitioners(branchId)
  const { assignMut, removeMut } = useBranchPractitionerMutations()

  const { data: allPractitioners, isLoading: loadingAll } = useQuery({
    queryKey: queryKeys.practitioners.list({ perPage: 200 }),
    queryFn: () => fetchPractitioners({ perPage: 200 }),
    enabled: open,
  })

  const assignedIds = useMemo(
    () => new Set((assigned ?? []).map((a) => a.practitionerId)),
    [assigned],
  )

  const unassigned = useMemo(() => {
    const items = allPractitioners?.items ?? []
    return items.filter(
      (p) =>
        !assignedIds.has(p.id) &&
        (search === "" ||
          p.user.firstName.toLowerCase().includes(search.toLowerCase()) ||
          p.user.lastName.toLowerCase().includes(search.toLowerCase())),
    )
  }, [allPractitioners, assignedIds, search])

  const toggleSelection = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const handleAssign = () => {
    if (!branchId || selected.length === 0) return
    assignMut.mutate(
      { branchId, practitionerIds: selected },
      {
        onSuccess: () => {
          toast.success(t("branches.practitioners.assigned"))
          setSelected([])
          setSearch("")
        },
      },
    )
  }

  const handleRemove = (practitionerId: string) => {
    if (!branchId) return
    removeMut.mutate(
      { branchId, practitionerId },
      { onSuccess: () => toast.success(t("branches.practitioners.removed")) },
    )
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelected([])
      setSearch("")
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("branches.practitioners.title")} — {branchName}
          </DialogTitle>
          <DialogDescription>
            {t("branches.practitioners.description")}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-6">
          {/* ── Assigned Practitioners ── */}
          <div>
            <h4 className="mb-3 text-sm font-medium text-foreground">
              {t("branches.practitioners.current")} ({assigned?.length ?? 0})
            </h4>
            {loadingAssigned ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 rounded-lg" />
                ))}
              </div>
            ) : (assigned ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("branches.practitioners.none")}
              </p>
            ) : (
              <div className="space-y-2">
                {(assigned ?? []).map((pb) => (
                  <div
                    key={pb.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">
                        {pb.practitioner.user.firstName} {pb.practitioner.user.lastName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {pb.practitioner.specialty}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {pb.isPrimary && (
                        <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-xs">
                          {t("branches.practitioners.primary")}
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRemove(pb.practitionerId)}
                        disabled={removeMut.isPending}
                      >
                        <HugeiconsIcon icon={Delete02Icon} size={14} className="text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* ── Add Practitioners ── */}
          <div>
            <h4 className="mb-3 text-sm font-medium text-foreground">
              {t("branches.practitioners.add")}
            </h4>

            <div className="relative mb-3">
              <HugeiconsIcon
                icon={Search01Icon}
                size={16}
                className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("branches.practitioners.searchPlaceholder")}
                className="ps-9"
              />
            </div>

            {loadingAll ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 rounded-lg" />
                ))}
              </div>
            ) : unassigned.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("branches.practitioners.allAssigned")}
              </p>
            ) : (
              <div className="max-h-52 space-y-1 overflow-y-auto">
                {unassigned.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selected.includes(p.id)}
                      onCheckedChange={() => toggleSelection(p.id)}
                    />
                    <div className="flex flex-col">
                      <span className="text-sm text-foreground">
                        {p.user.firstName} {p.user.lastName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {p.specialty}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {selected.length > 0 && (
              <Button
                className="mt-3 w-full"
                onClick={handleAssign}
                disabled={assignMut.isPending}
              >
                {assignMut.isPending
                  ? t("common.saving")
                  : `${t("branches.practitioners.assignSelected")} (${selected.length})`}
              </Button>
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
