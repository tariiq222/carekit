"use client"

import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  GiftIcon,
  Settings01Icon,
} from "@hugeicons/core-free-icons"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"
import { DateTimeInput } from "@/components/ui/date-time-input"
import { useGiftCardMutations } from "@/hooks/use-gift-cards"
import { useLocale } from "@/components/locale-provider"
import { SectionHeader } from "@/components/features/section-header"

/* ─── Schema ─── */

const createGiftCardSchema = z.object({
  code: z.string().max(20).regex(/^[A-Z0-9-]*$/i).optional().or(z.literal("")),
  initialAmount: z.coerce.number().min(0.01),
  expiresAt: z.string().optional(),
  isActive: z.boolean(),
})

type FormData = z.infer<typeof createGiftCardSchema>

/* ─── Page ─── */

export default function CreateGiftCardPage() {
  const router = useRouter()
  const { t } = useLocale()
  const { createMut } = useGiftCardMutations()

  const form = useForm<FormData>({
    resolver: zodResolver(createGiftCardSchema),
    defaultValues: {
      code: "",
      initialAmount: 100,
      expiresAt: "",
      isActive: true,
    },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await createMut.mutateAsync({
        code: data.code || undefined,
        initialAmount: Math.round(data.initialAmount * 100),
        expiresAt: data.expiresAt || undefined,
        isActive: data.isActive,
      })
      toast.success(t("giftCards.create.success"))
      router.push("/gift-cards")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("giftCards.create.error"))
    }
  })

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader title={t("giftCards.create.title")} description={t("giftCards.create.description")} />

      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* ── Amount & Code ── */}
          <Card>
            <CardContent className="pt-6">
              <SectionHeader icon={GiftIcon} title={t("giftCards.field.initialAmount")} description={t("giftCards.field.code")} />
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <Label>{t("giftCards.field.initialAmount")} (SAR) *</Label>
                  <Input
                    type="number"
                    min={0.01}
                    step="0.01"
                    {...form.register("initialAmount")}
                    placeholder="100.00"
                  />
                  {form.formState.errors.initialAmount && (
                    <p className="text-xs text-destructive">{form.formState.errors.initialAmount.message}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>{t("giftCards.field.code")}</Label>
                  <Input
                    {...form.register("code")}
                    placeholder={t("giftCards.create.codeHint")}
                    className="uppercase"
                    onChange={(e) => form.setValue("code", e.target.value.toUpperCase())}
                  />
                  <p className="text-xs text-muted-foreground">{t("giftCards.create.codeHint")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Settings ── */}
          <Card>
            <CardContent className="pt-6">
              <SectionHeader icon={Settings01Icon} title={t("giftCards.field.expiresAt")} description={t("giftCards.field.isActive")} />
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <Label>{t("giftCards.field.expiresAt")}</Label>
                  <Controller
                    control={form.control}
                    name="expiresAt"
                    render={({ field }) => (
                      <DateTimeInput
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        error={!!form.formState.errors.expiresAt}
                      />
                    )}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <Label htmlFor="create-giftcard-active" className="cursor-pointer text-sm">
                    {t("giftCards.field.isActive")}
                  </Label>
                  <Switch
                    id="create-giftcard-active"
                    checked={form.watch("isActive")}
                    onCheckedChange={(v) => form.setValue("isActive", v)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.push("/gift-cards")}>
            {t("giftCards.create.cancel")}
          </Button>
          <Button type="submit" disabled={createMut.isPending}>
            {createMut.isPending ? t("giftCards.create.submitting") : t("giftCards.create.submit")}
          </Button>
        </div>
      </form>
    </ListPageShell>
  )
}
