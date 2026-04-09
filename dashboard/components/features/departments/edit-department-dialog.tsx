"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetBody,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { useDepartmentMutations } from "@/hooks/use-departments"
import { useLocale } from "@/components/locale-provider"
import {
  departmentSchema,
  type DepartmentFormData,
} from "@/lib/schemas/department.schema"
import type { Department } from "@/lib/types/department"

interface EditDepartmentDialogProps {
  department: Department | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditDepartmentDialog({
  department,
  open,
  onOpenChange,
}: EditDepartmentDialogProps) {
  const { t } = useLocale()
  const { updateMut } = useDepartmentMutations()

  const form = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      nameAr: "",
      nameEn: "",
      descriptionAr: "",
      descriptionEn: "",
      icon: "",
      isActive: true,
    },
  })

  useEffect(() => {
    if (department && open) {
      form.reset({
        nameAr: department.nameAr,
        nameEn: department.nameEn,
        descriptionAr: department.descriptionAr ?? "",
        descriptionEn: department.descriptionEn ?? "",
        icon: department.icon ?? "",
        isActive: department.isActive,
      })
    }
  }, [department, open, form])

  const onSubmit = form.handleSubmit(async (data) => {
    if (!department) return
    try {
      await updateMut.mutateAsync({
        id: department.id,
        nameAr: data.nameAr,
        nameEn: data.nameEn,
        descriptionAr: data.descriptionAr || undefined,
        descriptionEn: data.descriptionEn || undefined,
        icon: data.icon || undefined,
        isActive: data.isActive,
      })
      toast.success(t("departments.edit.success"))
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("departments.edit.error"))
    }
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end">
        <SheetHeader>
          <SheetTitle>{t("departments.edit.title")}</SheetTitle>
        </SheetHeader>

        <SheetBody>
          <form id="edit-dept-form" onSubmit={onSubmit} className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t("departments.field.nameEn")} *</Label>
                <Input {...form.register("nameEn")} />
                {form.formState.errors.nameEn && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.nameEn.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("departments.field.nameAr")} *</Label>
                <Input {...form.register("nameAr")} dir="rtl" />
                {form.formState.errors.nameAr && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.nameAr.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t("departments.field.descriptionEn")}</Label>
                <Input {...form.register("descriptionEn")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("departments.field.descriptionAr")}</Label>
                <Input {...form.register("descriptionAr")} dir="rtl" />
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="edit-dept-active" className="cursor-pointer">
                {t("departments.field.isActive")}
              </Label>
              <Switch
                id="edit-dept-active"
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
            {t("departments.edit.cancel")}
          </Button>
          <Button type="submit" form="edit-dept-form" disabled={updateMut.isPending}>
            {updateMut.isPending ? t("departments.edit.submitting") : t("departments.edit.submit")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
