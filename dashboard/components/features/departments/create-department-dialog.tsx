"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
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
import { useDepartmentMutations } from "@/hooks/use-departments"
import { useLocale } from "@/components/locale-provider"
import {
  departmentSchema,
  type DepartmentFormData,
} from "@/lib/schemas/department.schema"

interface CreateDepartmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateDepartmentDialog({
  open,
  onOpenChange,
}: CreateDepartmentDialogProps) {
  const { t } = useLocale()
  const { createMut } = useDepartmentMutations()

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

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await createMut.mutateAsync({
        nameAr: data.nameAr,
        nameEn: data.nameEn,
        descriptionAr: data.descriptionAr || undefined,
        descriptionEn: data.descriptionEn || undefined,
        icon: data.icon || undefined,
        isActive: data.isActive,
      })
      toast.success(t("departments.create.success"))
      form.reset()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("departments.create.error"))
    }
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end">
        <SheetHeader>
          <SheetTitle>{t("departments.create.title")}</SheetTitle>
          <SheetDescription>{t("departments.create.description")}</SheetDescription>
        </SheetHeader>

        <SheetBody>
          <form id="create-dept-form" onSubmit={onSubmit} className="flex flex-col gap-5">
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
              <Label htmlFor="create-dept-active" className="cursor-pointer">
                {t("departments.field.isActive")}
              </Label>
              <Switch
                id="create-dept-active"
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
            {t("departments.create.cancel")}
          </Button>
          <Button type="submit" form="create-dept-form" disabled={createMut.isPending}>
            {createMut.isPending ? t("departments.create.submitting") : t("departments.create.submit")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
