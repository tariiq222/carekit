"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

import { useRoleMutations } from "@/hooks/use-users"
import { useLocale } from "@/components/locale-provider"
import {
  createRoleSchema,
  type CreateRoleFormData,
} from "@/lib/schemas/user.schema"

/* ─── Props ─── */

interface CreateRoleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function CreateRoleDialog({ open, onOpenChange }: CreateRoleDialogProps) {
  const { t } = useLocale()
  const { createMut } = useRoleMutations()

  const form = useForm<CreateRoleFormData>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: { name: "", description: "" },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await createMut.mutateAsync({
        name: data.name,
        description: data.description || undefined,
      })
      toast.success(t("users.roles.create.success"))
      form.reset()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("users.roles.create.error"))
    }
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end" className="overflow-y-auto w-full sm:max-w-[45vw]">
        <SheetHeader>
          <SheetTitle>{t("users.roles.create.title")}</SheetTitle>
          <SheetDescription>
            {t("users.roles.create.description")}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="role-name">{t("users.roles.create.name")}</Label>
            <Input
              id="role-name"
              placeholder={t("users.roles.create.namePlaceholder")}
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="role-description">{t("users.roles.create.descriptionLabel")}</Label>
            <Textarea
              id="role-description"
              placeholder={t("users.roles.create.descriptionPlaceholder")}
              rows={3}
              {...form.register("description")}
            />
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("users.roles.create.cancel")}
            </Button>
            <Button type="submit" disabled={createMut.isPending}>
              {createMut.isPending ? t("users.roles.create.submitting") : t("users.roles.create.submit")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
