"use client"

import { useState } from "react"
import { Add01Icon, CreditCardIcon, Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge, Button, Card, CardContent, Skeleton } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { useBillingMutations, useSavedCards } from "@/hooks/use-current-subscription"
import type { SavedCard } from "@/lib/types/billing"
import { AddCardDialog } from "../../payment-methods/components/add-card-dialog"
import { RemoveCardDialog } from "../../payment-methods/components/remove-card-dialog"
import { SetDefaultCardDialog } from "../../payment-methods/components/set-default-card-dialog"

function formatBrand(brand: string) {
  return brand.toUpperCase()
}

function formatExpiry(card: Pick<SavedCard, "expiryMonth" | "expiryYear">) {
  return `${String(card.expiryMonth).padStart(2, "0")} / ${card.expiryYear}`
}

function formatCardLabel(card: Pick<SavedCard, "brand" | "last4">) {
  return `${formatBrand(card.brand)} •••• ${card.last4}`
}

export function PaymentMethodsTab() {
  const { t } = useLocale()
  const { data: cards = [], isLoading } = useSavedCards()
  const { setDefaultSavedCardMut, removeSavedCardMut } = useBillingMutations()
  const [addOpen, setAddOpen] = useState(false)
  const [defaultCard, setDefaultCard] = useState<SavedCard | null>(null)
  const [removeCard, setRemoveCard] = useState<SavedCard | null>(null)

  async function confirmDefault() {
    if (!defaultCard) return
    await setDefaultSavedCardMut.mutateAsync(defaultCard.id)
    setDefaultCard(null)
  }

  async function confirmRemove() {
    if (!removeCard) return
    await removeSavedCardMut.mutateAsync(removeCard.id)
    setRemoveCard(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setAddOpen(true)}>
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4" />
          {t("billing.paymentMethods.add")}
        </Button>
      </div>

      <div className="space-y-3">
        {isLoading && (
          <>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </>
        )}

        {!isLoading && cards.length === 0 && (
          <Card>
            <CardContent className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
              <HugeiconsIcon icon={CreditCardIcon} strokeWidth={1.8} className="size-5" />
              {t("billing.paymentMethods.empty")}
            </CardContent>
          </Card>
        )}

        {cards.map((card) => (
          <Card key={card.id} size="sm">
            <CardContent className="flex flex-col gap-4 py-1 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-md border border-border bg-muted">
                  <HugeiconsIcon icon={CreditCardIcon} strokeWidth={1.8} className="size-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{formatBrand(card.brand)}</p>
                    <p className="font-mono text-sm text-muted-foreground" dir="ltr">
                      •••• {card.last4}
                    </p>
                    {card.isDefault && (
                      <Badge variant="success" className="gap-1">
                        <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-3" />
                        {t("billing.paymentMethods.default")}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground" dir="ltr">
                    {formatExpiry(card)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 md:justify-end">
                {!card.isDefault && (
                  <Button size="sm" variant="outline" onClick={() => setDefaultCard(card)}>
                    {t("billing.paymentMethods.setDefault")}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="text-error hover:text-error"
                  onClick={() => setRemoveCard(card)}
                >
                  {t("billing.paymentMethods.remove")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AddCardDialog open={addOpen} onOpenChange={setAddOpen} />

      {defaultCard && (
        <SetDefaultCardDialog
          open={Boolean(defaultCard)}
          pending={setDefaultSavedCardMut.isPending}
          cardLabel={formatCardLabel(defaultCard)}
          onOpenChange={(open) => {
            if (!open) setDefaultCard(null)
          }}
          onConfirm={confirmDefault}
        />
      )}

      {removeCard && (
        <RemoveCardDialog
          open={Boolean(removeCard)}
          pending={removeSavedCardMut.isPending}
          cardLabel={formatCardLabel(removeCard)}
          onOpenChange={(open) => {
            if (!open) setRemoveCard(null)
          }}
          onConfirm={confirmRemove}
        />
      )}
    </div>
  )
}
