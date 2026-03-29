"use client"

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

const createBranchSchema = z.object({
  nameAr: z.string().min(1).max(255),
  nameEn: z.string().min(1).max(255),
  address: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal("")),
  isMain: z.boolean().optional(),
  isActive: z.boolean().optional(),
  timezone: z.string().optional(),
})

type FormData = z.infer<typeof createBranchSchema>

/* ─── Props ─── */

interface CreateBranchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function CreateBranchDialog({
  open,
  onOpenChange,
}: CreateBranchDialogProps) {
  const { t } = useLocale()
  const { createMut } = useBranchMutations()

  const form = useForm<FormData>({
    resolver: zodResolver(createBranchSchema),
    defaultValues: {
      nameAr: "",
      nameEn: "",
      address: "",
      phone: "",
      email: "",
      isMain: false,
      isActive: true,
      timezone: "Asia/Riyadh",
    },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await createMut.mutateAsync({
        nameAr: data.nameAr,
        nameEn: data.nameEn,
        address: data.address || undefined,
        phone: data.phone || undefined,
        email: data.email || undefined,
        isMain: data.isMain,
        isActive: data.isActive,
        timezone: data.timezone,
      })
      toast.success(t("branches.create.success"))
      form.reset()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("branches.create.error"))
    }
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end">
        <SheetHeader>
          <SheetTitle>{t("branches.create.title")}</SheetTitle>
          <SheetDescription>{t("branches.create.description")}</SheetDescription>
        </SheetHeader>

        <SheetBody>
          <form id="create-branch-form" onSubmit={onSubmit} className="flex flex-col gap-5">
            {/* Names */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t("branches.field.nameEn")} *</Label>
                <Input {...form.register("nameEn")} placeholder="Main Branch" />
                {form.formState.errors.nameEn && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.nameEn.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("branches.field.nameAr")} *</Label>
                <Input {...form.register("nameAr")} dir="rtl" placeholder="الفرع الرئيسي" />
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
                <Input {...form.register("phone")} dir="ltr" placeholder="+966..." />
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
              <Label htmlFor="create-branch-main" className="cursor-pointer">
                {t("branches.field.isMain")}
              </Label>
              <Switch
                id="create-branch-main"
                checked={form.watch("isMain")}
                onCheckedChange={(v) => form.setValue("isMain", v)}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="create-branch-active" className="cursor-pointer">
                {t("branches.field.isActive")}
              </Label>
              <Switch
                id="create-branch-active"
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
            {t("branches.create.cancel")}
          </Button>
          <Button type="submit" form="create-branch-form" disabled={createMut.isPending}>
            {createMut.isPending ? t("branches.create.submitting") : t("branches.create.submit")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
