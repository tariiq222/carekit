"use client"

/**
 * Widget Confirm Step — Review booking summary and confirm
 * Also handles the success state after booking is created.
 */

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle01Icon,
  Building01Icon,
  Video01Icon,
  Calendar03Icon,
  Clock01Icon,
  Loading03Icon,
  Tag01Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { validateWidgetCode, fetchWidgetBranding } from "@/lib/api/widget"
import type { WidgetBankAccount } from "@/lib/api/widget"
import { SAUDI_BANKS } from "@/components/features/settings/bank-account-card"
import type { useWidgetBooking } from "@/hooks/use-widget-booking"
import type { BookingType } from "@/lib/types/booking"

/* ─── Booking type labels ─── */

const TYPE_LABELS: Record<BookingType, { ar: string; en: string; icon: React.ReactNode }> = {
  in_person: { ar: "زيارة حضورية", en: "In Person", icon: <HugeiconsIcon icon={Building01Icon} size={16} /> },
  online: { ar: "عن بعد", en: "Online", icon: <HugeiconsIcon icon={Video01Icon} size={16} /> },
  walk_in: { ar: "زيارة مباشرة", en: "Walk-in", icon: <HugeiconsIcon icon={Building01Icon} size={16} /> },
}

/* ─── Price helper ─── */

function getPrice(booking: ReturnType<typeof useWidgetBooking>): number {
  const { state } = booking
  if (state.durationOption) return state.durationOption.price
  if (state.service) return state.service.price
  return 0
}

/* ─── Props ─── */

interface Props {
  locale: "ar" | "en"
  booking: ReturnType<typeof useWidgetBooking>
  showPrice?: boolean
  redirectUrl?: string | null
}

export function WidgetConfirmStep({ locale, booking, showPrice = true, redirectUrl }: Props) {
  const { state, confirmBooking, isConfirming, confirmError, applyDiscount, clearDiscount, selectPaymentMethod } = booking
  const [codeInput, setCodeInput] = useState("")
  const [codeError, setCodeError] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const isRtl = locale === "ar"

  const { employee, service, bookingType, date, slot, paymentMethod } = state
  const price = getPrice(booking)
  const discount = state.discountAmount ?? 0
  const discountedPrice = Math.max(0, price - discount)
  const vat = Math.round(discountedPrice * 0.15 * 100) / 100
  const total = Math.round((discountedPrice + vat) * 100) / 100

  /* ─── Branding (payment flags) ─── */
  const { data: branding } = useQuery({
    queryKey: ["widget", "branding"],
    queryFn: fetchWidgetBranding,
    staleTime: 10 * 60 * 1000,
  })

  const moyasarEnabled = branding?.payment_moyasar_enabled === "true"
  const atClinicEnabled =
    branding?.payment_at_clinic_enabled === "true" ||
    branding?.payment_at_clinic_enabled === null ||
    branding?.payment_at_clinic_enabled === undefined
  const bankTransferEnabled = branding?.bank_transfer_enabled === true
  const bankAccounts = branding?.bank_accounts ?? []

  useEffect(() => {
    const onlyMoyasar = moyasarEnabled && !atClinicEnabled && !bankTransferEnabled
    const onlyAtClinic = !moyasarEnabled && atClinicEnabled && !bankTransferEnabled
    const onlyBank = !moyasarEnabled && !atClinicEnabled && bankTransferEnabled
    if (onlyMoyasar && !paymentMethod) selectPaymentMethod("moyasar")
    else if (onlyAtClinic && !paymentMethod) selectPaymentMethod("at_clinic")
    else if (onlyBank && !paymentMethod) selectPaymentMethod("bank_transfer")
  }, [moyasarEnabled, atClinicEnabled, bankTransferEnabled, paymentMethod, selectPaymentMethod])

  /* ─── Coupon handler ─── */
  async function handleApplyCode() {
    if (!codeInput.trim() || !service) return
    setIsValidating(true)
    setCodeError(null)
    try {
      const result = await validateWidgetCode({
        code: codeInput.trim(),
        serviceId: service.id,
        amount: price,
      })
      if (result.valid) {
        applyDiscount(codeInput.trim(), result.discountAmount, result.couponId)
      } else {
        setCodeError(isRtl ? "الكود غير صالح أو منتهي الصلاحية" : "Invalid or expired code")
      }
    } catch {
      setCodeError(isRtl ? "حدث خطأ. حاول مجدداً." : "An error occurred. Try again.")
    } finally {
      setIsValidating(false)
    }
  }

  /* ─── Confirm eligibility ─── */
  const paymentRequired = moyasarEnabled || atClinicEnabled || bankTransferEnabled
  const canConfirm = !paymentRequired || !!paymentMethod

  /* ─── Success view ─── */
  if (state.step === "success" && state.booking) {
    return (
      <div className="flex flex-col items-center text-center py-4 space-y-3">
        <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
          <HugeiconsIcon icon={CheckmarkCircle01Icon} size={32} className="text-success" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">{isRtl ? "تم الحجز بنجاح!" : "Booking Confirmed!"}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {isRtl ? "سيتم إرسال تأكيد على بريدك الإلكتروني" : "A confirmation will be sent to your email"}
          </p>
        </div>
        <div className="w-full bg-muted/30 rounded-xl p-4 space-y-2 text-sm">
          <SummaryRow icon={<HugeiconsIcon icon={Calendar03Icon} size={14} />} label={isRtl ? "التاريخ" : "Date"} value={date} />
          <SummaryRow icon={<HugeiconsIcon icon={Clock01Icon} size={14} />} label={isRtl ? "الوقت" : "Time"} value={`${slot?.startTime} — ${slot?.endTime}`} />
          <Separator />
          <div className="flex justify-between font-medium">
            <span>{isRtl ? "رقم الحجز" : "Booking ID"}</span>
            <span className="text-xs font-mono text-muted-foreground">{state.booking.id.slice(0, 8).toUpperCase()}</span>
          </div>
        {redirectUrl && (
          <p className="text-xs text-muted-foreground animate-pulse mt-1">
            {isRtl ? "جاري التحويل..." : "Redirecting..."}
          </p>
        )}
        </div>
      </div>
    )
  }

  /* ─── Confirm view ─── */
  const typeConfig = bookingType ? TYPE_LABELS[bookingType] : null

  return (
    <div className="space-y-4">
{/* Summary card */}
      <div className="bg-muted/30 rounded-xl p-4 space-y-3 text-sm">
        {employee && (
          <SummaryRow
            label={isRtl ? "الطبيب" : "Employee"}
            value={isRtl && employee.nameAr ? employee.nameAr : `${employee.user.firstName} ${employee.user.lastName}`}
          />
        )}
        {service && <SummaryRow label={isRtl ? "الخدمة" : "Service"} value={isRtl ? service.nameAr : service.nameEn} />}
        {typeConfig && <SummaryRow icon={typeConfig.icon} label={isRtl ? "نوع الزيارة" : "Visit Type"} value={isRtl ? typeConfig.ar : typeConfig.en} />}
        <Separator />
        <SummaryRow icon={<HugeiconsIcon icon={Calendar03Icon} size={14} />} label={isRtl ? "التاريخ" : "Date"} value={date} />
        {slot && <SummaryRow icon={<HugeiconsIcon icon={Clock01Icon} size={14} />} label={isRtl ? "الوقت" : "Time"} value={`${slot.startTime} — ${slot.endTime}`} />}
        <Separator />
        {showPrice && (
          <>
        <SummaryRow label={isRtl ? "السعر" : "Price"} value={`${price} ${isRtl ? "ر.س" : "SAR"}`} />
        {discount > 0 && <SummaryRow label={isRtl ? "الخصم" : "Discount"} value={`-${discount} ${isRtl ? "ر.س" : "SAR"}`} />}
        <SummaryRow label={isRtl ? "ضريبة القيمة المضافة (15%)" : "VAT (15%)"} value={`${vat} ${isRtl ? "ر.س" : "SAR"}`} />
        <div className={cn("flex justify-between font-semibold text-primary")}>
          <span>{isRtl ? "الإجمالي" : "Total"}</span>
          <span>{total} {isRtl ? "ر.س" : "SAR"}</span>
        </div>
          </>
        )}  
      </div>

      {/* Discount code */}
      {!state.couponCode ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {isRtl ? "هل لديك كود خصم أو بطاقة هدية؟" : "Have a discount or gift card code?"}
          </p>
          <div className="flex gap-2">
            <Input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder={isRtl ? "أدخل الكود" : "Enter code"}
              className="text-sm h-9"
              onKeyDown={(e) => e.key === "Enter" && void handleApplyCode()}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleApplyCode()}
              disabled={isValidating || !codeInput.trim()}
              className="shrink-0"
            >
              {isValidating ? (
                <HugeiconsIcon icon={Loading03Icon} size={14} className="animate-spin" />
              ) : (
                isRtl ? "تطبيق" : "Apply"
              )}
            </Button>
          </div>
          {codeError && (
            <p className="text-xs text-destructive">{codeError}</p>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between bg-success/10 border border-success/30 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2 text-success text-sm">
            <HugeiconsIcon icon={Tag01Icon} size={14} />
            <span>{state.couponCode}</span>
            <span className="font-semibold">-{state.discountAmount} {isRtl ? "ر.س" : "SAR"}</span>
          </div>
          <button
            onClick={() => { clearDiscount(); setCodeInput("") }}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            {isRtl ? "إزالة" : "Remove"}
          </button>
        </div>
      )}

      {/* Payment method — show when more than one option is available */}
      {(moyasarEnabled || atClinicEnabled || bankTransferEnabled) && (
        <div className="space-y-2">
          {(Number(moyasarEnabled) + Number(atClinicEnabled) + Number(bankTransferEnabled)) > 1 && (
            <p className="text-sm font-medium">
              {isRtl ? "طريقة الدفع" : "Payment Method"}
            </p>
          )}
          <RadioGroup
            value={paymentMethod ?? ""}
            onValueChange={(v) => selectPaymentMethod(v as "moyasar" | "at_clinic" | "bank_transfer")}
            className="space-y-2"
          >
            {moyasarEnabled && (
              <label className={cn(
                "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all",
                paymentMethod === "moyasar" ? "border-primary/60 bg-primary/5" : "border-border/60",
              )}>
                <RadioGroupItem value="moyasar" />
                <span className="text-sm">{isRtl ? "دفع إلكتروني" : "Online Payment"}</span>
              </label>
            )}
            {atClinicEnabled && (
              <label className={cn(
                "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all",
                paymentMethod === "at_clinic" ? "border-primary/60 bg-primary/5" : "border-border/60",
              )}>
                <RadioGroupItem value="at_clinic" />
                <span className="text-sm">{isRtl ? "الدفع في العيادة" : "Pay at Clinic"}</span>
              </label>
            )}
            {bankTransferEnabled && (
              <label className={cn(
                "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all",
                paymentMethod === "bank_transfer" ? "border-primary/60 bg-primary/5" : "border-border/60",
              )}>
                <RadioGroupItem value="bank_transfer" />
                <span className="text-sm">{isRtl ? "تحويل بنكي" : "Bank Transfer"}</span>
              </label>
            )}
          </RadioGroup>

          {/* Bank accounts details — shown when bank transfer is selected */}
          {paymentMethod === "bank_transfer" && bankAccounts.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-xs text-muted-foreground">
                {isRtl ? "حوّل المبلغ لأحد الحسابات التالية وأرفق الإيصال بعد الحجز" : "Transfer to one of the accounts below and attach the receipt after booking"}
              </p>
              {bankAccounts.map((acc) => (
                <BankAccountDetails key={acc.id} account={acc} isRtl={isRtl} />
              ))}
            </div>
          )}
        </div>
      )}

      {!moyasarEnabled && !atClinicEnabled && !bankTransferEnabled && (
        <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
          {isRtl
            ? "سيتم التواصل معك لتأكيد الموعد والدفع"
            : "We'll contact you to confirm your appointment and payment"}
        </p>
      )}

      {confirmError && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          {isRtl ? "حدث خطأ أثناء الحجز. يرجى المحاولة مجدداً." : "Booking failed. Please try again."}
        </p>
      )}

      <Button
        className="w-full"
        disabled={isConfirming || !canConfirm}
        onClick={() => confirmBooking(undefined)}
      >
        {isConfirming && <HugeiconsIcon icon={Loading03Icon} size={16} className="me-2" />}
        {paymentMethod === "moyasar"
          ? (isRtl ? "متابعة للدفع" : "Proceed to Payment")
          : (isRtl ? "تأكيد الحجز" : "Confirm Booking")
        }
      </Button>
    </div>
  )
}

/* ─── Bank account details (shown in widget after selecting bank transfer) ─── */

function BankAccountDetails({ account, isRtl }: { account: WidgetBankAccount; isRtl: boolean }) {
  const bank = SAUDI_BANKS.find((b) => b.id === account.bankId)
  const bankName = bank ? (isRtl ? bank.nameAr : bank.nameEn) : account.bankId

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 text-xs">
      {bankName && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">{isRtl ? "البنك" : "Bank"}</span>
          <span className="font-medium">{bankName}</span>
        </div>
      )}
      {account.iban && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">{isRtl ? "رقم الآيبان" : "IBAN"}</span>
          <span className="font-numeric font-medium tracking-wider" dir="ltr">{account.iban}</span>
        </div>
      )}
      {account.holderName && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">{isRtl ? "اسم صاحب الحساب" : "Account Holder"}</span>
          <span className="font-medium">{account.holderName}</span>
        </div>
      )}
    </div>
  )
}

/* ─── Summary row helper ─── */

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-medium text-end">{value}</span>
    </div>
  )
}
