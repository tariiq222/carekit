"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetBody,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useBranchMutations } from "@/hooks/use-branches"
import { useLocale } from "@/components/locale-provider"
import type { Branch } from "@/lib/types/branch"

/* ─── Timezones ─── */

const TIMEZONES = [
  "Asia/Riyadh",
  "Asia/Dubai",
  "Asia/Kuwait",
  "Asia/Bahrain",
  "Asia/Qatar",
  "Africa/Cairo",
  "Europe/London",
  "America/New_York",
]

/* ─── Schema ─── */

const editBranchSchema = z.object({
  nameAr: z.string().min(1).max(255).optional(),
  nameEn: z.string().min(1).max(255).optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal("")),
  isMain: z.boolean().optional(),
  isActive: z.boolean().optional(),
  timezone: z.string().optional(),
})

type FormData = z.infer<typeof editBranchSchema>

/* ─── Props ─── */

interface EditBranchDialogProps {
  branch: Branch | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function EditBranchDialog({
  branch,
  open,
  onOpenChange,
}: EditBranchDialogProps) {
  const { t } = useLocale()
  const { updateMut } = useBranchMutations()

  const form = useForm<FormData>({
    resolver: zodResolver(editBranchSchema),
  })

  useEffect(() => {
    if (branch && open) {
      form.reset({
        nameAr: branch.nameAr,
        nameEn: branch.nameEn,
        address: branch.address ?? "",
        phone: branch.phone ?? "",
        email: branch.email ?? "",
        isMain: branch.isMain,
        isActive: branch.isActive,
        timezone: branch.timezone,
      })
    }
  }, [branch, open, form])

  const onSubmit = form.handleSubmit(async (data) => {
    if (!branch) return
    try {
      await updateMut.mutateAsync({
        id: branch.id,
        nameAr: data.nameAr,
        nameEn: data.nameEn,
        address: data.address || undefined,
        phone: data.phone || undefined,
        email: data.email || undefined,
        isMain: data.isMain,
        isActive: data.isActive,
        timezone: data.timezone,
      })
      toast.success(t("branches.edit.success"))
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("branches.edit.error"))
    }
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end">
        <SheetHeader>
          <SheetTitle>{t("branches.edit.title")}</SheetTitle>
          <SheetDescription>{t("branches.edit.description")}</SheetDescription>
        </SheetHeader>

        <SheetBody>
          <form id="edit-branch-form" onSubmit={onSubmit} className="flex flex-col gap-5">
            {/* Names */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t("branches.field.nameEn")} *</Label>
                <Input {...form.register("nameEn")} />
                {form.formState.errors.nameEn && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.nameEn.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("branches.field.nameAr")} *</Label>
                <Input {...form.register("nameAr")} dir="rtl" />
                {form.formState.errors.nameAr && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.nameAr.message}
                  </p>
                )}
              </div>
            </div>

            {/* Address */}
            <div className="flex flex-col gap-1.5">
              <Label>{t("branches.field.address")}</Label>
              <Input {...form.register("address")} />
            </div>

            {/* Phone & Email */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t("branches.field.phone")}</Label>
                <Input {...form.register("phone")} dir="ltr" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("branches.field.email")}</Label>
                <Input {...form.register("email")} type="email" dir="ltr" />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>
            </div>

            {/* Timezone */}
            <div className="flex flex-col gap-1.5">
              <Label>{t("branches.field.timezone")}</Label>
              <Select
                value={form.watch("timezone")}
                onValueChange={(v) => form.setValue("timezone", v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Toggles */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="edit-branch-main" className="cursor-pointer">
                {t("branches.field.isMain")}
              </Label>
              <Switch
                id="edit-branch-main"
                checked={form.watch("isMain")}
                onCheckedChange={(v) => form.setValue("isMain", v)}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="edit-branch-active" className="cursor-pointer">
                {t("branches.field.isActive")}
              </Label>
              <Switch
                id="edit-branch-active"
                checked={form.watch("isActive")}
                onCheckedChange={(v) => form.setValue("isActive", v)}
              />
            </div>
          </form>
        </SheetBody>

        <SheetFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("branches.edit.cancel")}
          </Button>
          <Button type="submit" form="edit-branch-form" disabled={updateMut.isPending}>
            {updateMut.isPending ? t("branches.edit.submitting") : t("branches.edit.submit")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
