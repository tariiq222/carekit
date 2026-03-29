"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetBody,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useGiftCard } from "@/hooks/use-gift-cards"
import { useLocale } from "@/components/locale-provider"
import { format } from "date-fns"
import { ar } from "date-fns/locale"
import { AddCreditDialog } from "./add-credit-dialog"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import type { GiftCard } from "@/lib/types/gift-card"

/* ─── Props ─── */

interface GiftCardDetailSheetProps {
  giftCard: GiftCard | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function GiftCardDetailSheet({
  giftCard,
  open,
  onOpenChange,
}: GiftCardDetailSheetProps) {
  const { t, locale } = useLocale()
  const isAr = locale === "ar"
  const dateFnsLocale = isAr ? ar : undefined
  const { data: detail } = useGiftCard(giftCard?.id ?? null)
  const [creditOpen, setCreditOpen] = useState(false)

  const card = detail ?? giftCard
  if (!card) return null

  const isExpired = card.expiresAt && new Date(card.expiresAt) < new Date()
  const isDepleted = card.balance <= 0 && card.isActive
  const spent = card.initialAmount - card.balance

  const statusLabel = isExpired
    ? t("giftCards.status.expired")
    : isDepleted
      ? t("giftCards.status.depleted")
      : card.isActive
        ? t("giftCards.status.active")
        : t("giftCards.status.inactive")

  const statusClass = isExpired
    ? "border-destructive/30 bg-destructive/10 text-destructive"
    : isDepleted
      ? "border-muted-foreground/30 bg-muted text-muted-foreground"
      : card.isActive
        ? "border-success/30 bg-success/10 text-success"
        : "border-muted-foreground/30 bg-muted text-muted-foreground"

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="end" className="w-full sm:w-[420px]">
          <SheetHeader>
            <SheetTitle className="font-mono">{card.code}</SheetTitle>
            <SheetDescription>
              <Badge variant="outline" className={statusClass}>{statusLabel}</Badge>
            </SheetDescription>
          </SheetHeader>

          <SheetBody>
            <div className="flex flex-col gap-5">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">{t("giftCards.detail.initial")}</span>
                  <span className="tabular-nums text-sm font-semibold"><FormattedCurrency amount={card.initialAmount} locale={locale} decimals={2} /></span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">{t("giftCards.detail.balance")}</span>
                  <span className="tabular-nums text-sm font-semibold text-primary"><FormattedCurrency amount={card.balance} locale={locale} decimals={2} /></span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">{t("giftCards.detail.spent")}</span>
                  <span className="tabular-nums text-sm font-semibold"><FormattedCurrency amount={spent} locale={locale} decimals={2} /></span>
                </div>
              </div>

              {/* Info */}
              <div className="flex flex-col gap-2 text-sm">
                {card.expiresAt && (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-muted-foreground shrink-0">{t("giftCards.detail.expires")}:</span>
                    <span className={`tabular-nums font-medium ${isExpired ? "text-destructive" : "text-foreground"}`}>
                      {format(new Date(card.expiresAt), "PP", { locale: dateFnsLocale })}
                    </span>
                  </div>
                )}
                <div className="flex items-baseline gap-1.5">
                  <span className="text-muted-foreground shrink-0">{t("giftCards.detail.created")}:</span>
                  <span className="tabular-nums font-medium text-foreground">
                    {format(new Date(card.createdAt), "PP", { locale: dateFnsLocale })}
                  </span>
                </div>
              </div>

              <Separator />

              {/* Add Credit Button */}
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setCreditOpen(true)}
              >
                <HugeiconsIcon icon={Add01Icon} size={14} />
                {t("giftCards.detail.addCredit")}
              </Button>

              <Separator />

              {/* Transactions */}
              <div className="flex flex-col gap-3">
                <h4 className="text-sm font-semibold text-foreground">
                  {t("giftCards.detail.transactions")}
                </h4>

                {(!detail?.transactions || detail.transactions.length === 0) ? (
                  <p className="text-sm text-muted-foreground">
                    {t("giftCards.detail.noTransactions")}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {detail.transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm text-foreground">
                            {tx.note ?? (tx.amount > 0 ? t("giftCards.detail.credit") : t("giftCards.detail.debit"))}
                          </span>
                          <span className="tabular-nums text-xs text-muted-foreground">
                            {format(new Date(tx.createdAt), "PPp", { locale: dateFnsLocale })}
                          </span>
                        </div>
                        <span
                          className={`tabular-nums text-sm font-semibold ${
                            tx.amount > 0 ? "text-success" : "text-destructive"
                          }`}
                        >
                          {tx.amount > 0 ? "+" : ""}<FormattedCurrency amount={tx.amount} locale={locale} decimals={2} />
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </SheetBody>
        </SheetContent>
      </Sheet>

      <AddCreditDialog
        giftCard={card}
        open={creditOpen}
        onOpenChange={setCreditOpen}
      />
    </>
  )
}
