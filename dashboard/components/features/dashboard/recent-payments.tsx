"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { cn, formatName, formatCurrency } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useLocale } from "@/components/locale-provider"
import { queryKeys } from "@/lib/query-keys"
import { fetchPayments } from "@/lib/api/payments"
import type { PaymentStatus, PaymentMethod } from "@/lib/types/common"

const statusConfig: Record<
  PaymentStatus,
  { label: string; labelEn: string; dot: string; text: string }
> = {
  paid: {
    label: "مدفوع",
    labelEn: "Paid",
    dot: "bg-success",
    text: "text-success",
  },
  pending: {
    label: "معلق",
    labelEn: "Pending",
    dot: "bg-warning",
    text: "text-warning",
  },
  refunded: {
    label: "مُسترجع",
    labelEn: "Refunded",
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
  },
  failed: {
    label: "فشل",
    labelEn: "Failed",
    dot: "bg-destructive",
    text: "text-destructive",
  },
  awaiting: {
    label: "في الانتظار",
    labelEn: "Awaiting",
    dot: "bg-warning",
    text: "text-warning",
  },
  rejected: {
    label: "مرفوض",
    labelEn: "Rejected",
    dot: "bg-destructive",
    text: "text-destructive",
  },
}

const methodLabel: Record<PaymentMethod, { ar: string; en: string }> = {
  moyasar: { ar: "موي‌سر", en: "Moyasar" },
  bank_transfer: { ar: "تحويل بنكي", en: "Bank Transfer" },
  cash: { ar: "نقدي", en: "Cash" },
}

const RECENT_QUERY = { page: 1, perPage: 5 }

export function RecentPayments() {
  const { locale } = useLocale()

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.payments.list(RECENT_QUERY),
    queryFn: () => fetchPayments(RECENT_QUERY),
    staleTime: 60_000,
  })

  const payments = data?.items ?? []

  return (
    <Card className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground">
          {locale === "ar" ? "آخر المدفوعات" : "Recent Payments"}
        </h2>
        <Link
          href="/payments"
          className="text-xs font-medium text-primary hover:underline"
        >
          {locale === "ar" ? "عرض الكل" : "View all"}
          <span className="inline-block rtl:rotate-180 ms-1">→</span>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-4 w-16 rounded" />
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-4 w-14 rounded" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {locale === "ar"
            ? "تعذّر تحميل المدفوعات"
            : "Failed to load payments"}
        </p>
      ) : payments.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {locale === "ar" ? "لا توجد مدفوعات حديثة" : "No recent payments"}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="pb-3 text-start font-medium">
                  {locale === "ar" ? "المريض" : "Patient"}
                </th>
                <th className="pb-3 text-start font-medium">
                  {locale === "ar" ? "المبلغ" : "Amount"}
                </th>
                <th className="pb-3 text-start font-medium">
                  {locale === "ar" ? "الطريقة" : "Method"}
                </th>
                <th className="pb-3 text-start font-medium">
                  {locale === "ar" ? "الحالة" : "Status"}
                </th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const s = statusConfig[p.status]
                const patient = p.booking?.patient
                const patientName = patient
                  ? formatName(patient.firstName, patient.lastName, locale === "ar" ? "غير محدد" : "Unknown")
                  : locale === "ar"
                  ? "غير محدد"
                  : "Unknown"
                const method = methodLabel[p.method]
                const amountDisplay = formatCurrency(p.amount, locale, 2)

                return (
                  <tr
                    key={p.id}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="py-3 font-medium text-foreground">
                      {patientName}
                    </td>
                    <td className="py-3 tabular-nums text-foreground">
                      {amountDisplay} {locale === "ar" ? "ر.س" : "SAR"}
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {locale === "ar" ? method.ar : method.en}
                    </td>
                    <td className="py-3">
                      <span
                        className={cn(
                          "flex items-center gap-1.5 text-xs font-medium",
                          s.text,
                        )}
                      >
                        <span className={cn("size-2 rounded-full", s.dot)} />
                        {locale === "ar" ? s.label : s.labelEn}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
