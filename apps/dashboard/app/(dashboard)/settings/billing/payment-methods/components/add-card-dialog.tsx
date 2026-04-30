"use client"

import { useState, type FormEvent } from "react"
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@carekit/ui"
import { useLocale } from "@/components/locale-provider"
import { useBillingMutations } from "@/hooks/use-current-subscription"

interface AddCardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type MoyasarTokenizer = {
  tokenize: (form: HTMLFormElement) => Promise<{ id: string }>
}

export function AddCardDialog({ open, onOpenChange }: AddCardDialogProps) {
  const { t } = useLocale()
  const { addSavedCardMut } = useBillingMutations()
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    try {
      const token = await tokenizeWithMoyasar(event.currentTarget)
      await addSavedCardMut.mutateAsync({
        moyasarTokenId: token.id,
        makeDefault: true,
      })
      onOpenChange(false)
    } catch (caught) {
      setError(resolveErrorMessage(caught, t))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={(event) => void submit(event)}>
          <DialogHeader>
            <DialogTitle>{t("billing.paymentMethods.add")}</DialogTitle>
            <DialogDescription>
              {t("billing.paymentMethods.smallVerification")}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <input
              type="hidden"
              name="publishable_api_key"
              value={process.env.NEXT_PUBLIC_MOYASAR_PLATFORM_PUBLISHABLE_KEY ?? ""}
            />
            <input type="hidden" name="save_only" value="true" />

            <Input
              name="name"
              placeholder={t("billing.paymentMethods.cardHolder")}
              autoComplete="cc-name"
            />
            <Input
              name="number"
              placeholder={t("billing.paymentMethods.cardNumber")}
              inputMode="numeric"
              autoComplete="cc-number"
              dir="ltr"
            />
            <div className="grid grid-cols-3 gap-2">
              <Input
                name="month"
                placeholder={t("billing.paymentMethods.expiryMonth")}
                inputMode="numeric"
                autoComplete="cc-exp-month"
                dir="ltr"
              />
              <Input
                name="year"
                placeholder={t("billing.paymentMethods.expiryYear")}
                inputMode="numeric"
                autoComplete="cc-exp-year"
                dir="ltr"
              />
              <Input
                name="cvc"
                placeholder={t("billing.paymentMethods.cvc")}
                inputMode="numeric"
                autoComplete="cc-csc"
                dir="ltr"
              />
            </div>
            {error && <p className="text-sm text-error">{error}</p>}
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={addSavedCardMut.isPending}
              onClick={() => onOpenChange(false)}
            >
              {t("billing.actions.back")}
            </Button>
            <Button type="submit" disabled={addSavedCardMut.isPending}>
              {addSavedCardMut.isPending
                ? t("billing.actions.submitting")
                : t("billing.paymentMethods.add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

async function tokenizeWithMoyasar(form: HTMLFormElement): Promise<{ id: string }> {
  const key = process.env.NEXT_PUBLIC_MOYASAR_PLATFORM_PUBLISHABLE_KEY
  if (!key) throw new Error("moyasar_key_missing")
  const moyasar = await loadMoyasar()
  return moyasar.tokenize(form)
}

async function loadMoyasar(): Promise<MoyasarTokenizer> {
  if (typeof window === "undefined") throw new Error("moyasar_browser_only")

  const existing = (window as Window & { Moyasar?: MoyasarTokenizer }).Moyasar
  if (existing) return existing

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = "https://cdn.moyasar.com/mpf/1.15.0/moyasar.js"
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("moyasar_script_failed"))
    document.head.appendChild(script)
  })

  const loaded = (window as Window & { Moyasar?: MoyasarTokenizer }).Moyasar
  if (!loaded) throw new Error("moyasar_unavailable")
  return loaded
}

function resolveErrorMessage(error: unknown, t: (key: string) => string) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes("saved_card_verification_requires_retry")) {
    return t("billing.paymentMethods.retryRequired")
  }
  return t("billing.paymentMethods.addFailed")
}
