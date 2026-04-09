"use client"

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
import {
  createCategorySchema,
  type CreateCategoryFormData,
} from "@/lib/schemas/service.schema"

/* ─── Props ─── */

interface CreateCategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function CreateCategoryDialog({
  open,
  onOpenChange,
}: CreateCategoryDialogProps) {
  const { t } = useLocale()
  const { createMut } = useCategoryMutations()
  const { options: departments } = useDepartmentOptions()

  const form = useForm<CreateCategoryFormData>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: { nameEn: "", nameAr: "", sortOrder: 0, departmentId: null },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await createMut.mutateAsync(data)
      toast.success(t("services.categories.create.success"))
      form.reset()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("services.categories.create.error"))
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("services.categories.create.title")}</DialogTitle>
          <DialogDescription>{t("services.categories.create.description")}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form id="create-category-form" onSubmit={onSubmit} className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t("services.categories.create.nameEn")} *</Label>
                <Input {...form.register("nameEn")} />
                {form.formState.errors.nameEn && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.nameEn.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("services.categories.create.nameAr")} *</Label>
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

            {departments.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label>{t("services.categories.create.department")}</Label>
                <Select
                  value={form.watch("departmentId") ?? "__none__"}
                  onValueChange={(v) =>
                    form.setValue("departmentId", v === "__none__" ? null : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("services.categories.create.departmentPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t("services.categories.create.departmentPlaceholder")}</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nameAr} / {d.nameEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("services.categories.create.cancel")}
          </Button>
          <Button type="submit" form="create-category-form" disabled={createMut.isPending}>
            {createMut.isPending
              ? t("services.categories.create.submitting")
              : t("services.categories.create.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
