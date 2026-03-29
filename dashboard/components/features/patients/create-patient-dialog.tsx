"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { useUserMutations } from "@/hooks/use-users"
import { useInvalidatePatients } from "@/hooks/use-patients"
import { useLocale } from "@/components/locale-provider"

/* ─── Schema ─── */

const createPatientSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  gender: z.enum(["male", "female"]).optional(),
})

type CreatePatientForm = z.infer<typeof createPatientSchema>

/* ─── Component ─── */

interface CreatePatientSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreatePatientDialog({
  open,
  onOpenChange,
}: CreatePatientSheetProps) {
  const { t } = useLocale()
  const { createMut } = useUserMutations()
  const invalidatePatients = useInvalidatePatients()

  const form = useForm<CreatePatientForm>({
    resolver: zodResolver(createPatientSchema),
    defaultValues: {
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      phone: "",
    },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await createMut.mutateAsync({
        ...data,
        roleSlug: "patient",
      })
      toast.success(t("patients.create.success"))
      form.reset()
      onOpenChange(false)
      invalidatePatients()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("patients.create.error"),
      )
    }
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end">
        <SheetHeader>
          <SheetTitle>{t("patients.create.title")}</SheetTitle>
          <SheetDescription>
            {t("patients.create.description")}
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          <form id="create-patient-form" onSubmit={onSubmit} className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t("patients.create.firstName")} *</Label>
                <Input {...form.register("firstName")} />
                {form.formState.errors.firstName && (
                  <p className="text-xs text-error">
                    {form.formState.errors.firstName.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("patients.create.lastName")} *</Label>
                <Input {...form.register("lastName")} />
                {form.formState.errors.lastName && (
                  <p className="text-xs text-error">
                    {form.formState.errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{t("patients.create.email")} *</Label>
              <Input type="email" {...form.register("email")} />
              {form.formState.errors.email && (
                <p className="text-xs text-error">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{t("patients.create.password")} *</Label>
              <Input type="password" {...form.register("password")} />
              {form.formState.errors.password && (
                <p className="text-xs text-error">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{t("patients.create.phone")}</Label>
              <Input {...form.register("phone")} placeholder="+966 5XX XXX XXX" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{t("patients.create.gender")}</Label>
              <Select
                value={form.watch("gender") ?? ""}
                onValueChange={(v) =>
                  form.setValue("gender", v as "male" | "female")
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={t("patients.create.genderPlaceholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">
                    {t("patients.create.male")}
                  </SelectItem>
                  <SelectItem value="female">
                    {t("patients.create.female")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </form>
        </SheetBody>

        <SheetFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("patients.create.cancel")}
          </Button>
          <Button
            type="submit"
            form="create-patient-form"
            disabled={createMut.isPending}
          >
            {createMut.isPending
              ? t("patients.create.submitting")
              : t("patients.create.submit")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
