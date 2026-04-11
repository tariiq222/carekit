"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCategoryMutations } from "@/hooks/use-services"
import { useDepartmentOptions } from "@/hooks/use-departments"
import { useLocale } from "@/components/locale-provider"
import type { ServiceCategory } from "@/lib/types/service"
import {
  editCategorySchema,
  type EditCategoryFormData,
} from "@/lib/schemas/service.schema"

/* ─── Props ─── */

interface EditCategoryDialogProps {
  category: ServiceCategory | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function EditCategoryDialog({
  category,
  open,
  onOpenChange,
}: EditCategoryDialogProps) {
  const { t } = useLocale()
  const { updateMut } = useCategoryMutations()
  const { options: departments } = useDepartmentOptions()

  const form = useForm<EditCategoryFormData>({
    resolver: zodResolver(editCategorySchema),
  })

  useEffect(() => {
    if (category) {
      form.reset({
        nameEn: category.nameEn,
        nameAr: category.nameAr,
        sortOrder: category.sortOrder,
        isActive: category.isActive,
        departmentId: category.departmentId,
      })
    }
  }, [category, form])

  const onSubmit = form.handleSubmit(async (data) => {
    if (!category) return
    try {
      await updateMut.mutateAsync({ id: category.id, ...data })
      toast.success(t("services.categories.edit.success"))
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("services.categories.edit.error"))
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("services.categories.edit.title")}</DialogTitle>
          <DialogDescription>{t("services.categories.edit.description")}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form id="edit-category-form" onSubmit={onSubmit} className="flex flex-col gap-5">
            {/* Active toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="edit-cat-active" className="cursor-pointer">
                {t("services.categories.edit.isActive")}
              </Label>
              <Switch
                id="edit-cat-active"
                checked={form.watch("isActive")}
                onCheckedChange={(v) => form.setValue("isActive", v)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t("services.categories.create.nameEn")}</Label>
                <Input {...form.register("nameEn")} />
                {form.formState.errors.nameEn && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.nameEn.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("services.categories.create.nameAr")}</Label>
                <Input {...form.register("nameAr")} dir="rtl" />
                {form.formState.errors.nameAr && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.nameAr.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{t("services.categories.create.sortOrder")}</Label>
              <Input type="number" min={0} {...form.register("sortOrder")} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{t("services.categories.edit.department")} *</Label>
              <Select
                value={form.watch("departmentId") || ""}
                onValueChange={(v) => form.setValue("departmentId", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("services.categories.edit.departmentPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.nameAr} / {d.nameEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("services.categories.edit.cancel")}
          </Button>
          <Button type="submit" form="edit-category-form" disabled={updateMut.isPending}>
            {updateMut.isPending
              ? t("services.categories.edit.submitting")
              : t("services.categories.edit.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
