"use client"

// SaaS-02g-sms — last 50 deliveries table.

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@carekit/ui"
import { useLocale } from "@/components/locale-provider"
import { useSmsDeliveries } from "@/hooks/use-sms-config"
import type { SmsDeliveryStatus } from "@/lib/types/sms"

function StatusBadge({ status }: { status: SmsDeliveryStatus }) {
  const cls = (() => {
    switch (status) {
      case "DELIVERED":
        return "bg-success/10 text-success border-success/30"
      case "SENT":
      case "QUEUED":
        return "bg-primary/10 text-primary border-primary/30"
      case "FAILED":
        return "bg-destructive/10 text-destructive border-destructive/30"
      default:
        return "bg-muted text-muted-foreground"
    }
  })()
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${cls}`}
    >
      {status}
    </span>
  )
}

export function SmsDeliveryLogTable() {
  const { locale } = useLocale()
  const isAr = locale === "ar"
  const { deliveries, loading } = useSmsDeliveries()

  const format = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(isAr ? "ar-SA" : "en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—"

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isAr ? "سجل الإرسال" : "Delivery log"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground">
            {isAr ? "جارٍ التحميل..." : "Loading..."}
          </p>
        ) : deliveries.length === 0 ? (
          <p className="text-muted-foreground">
            {isAr ? "لا توجد رسائل مرسلة بعد" : "No messages sent yet"}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{isAr ? "الرقم" : "Phone"}</TableHead>
                <TableHead>{isAr ? "المزود" : "Provider"}</TableHead>
                <TableHead>{isAr ? "الحالة" : "Status"}</TableHead>
                <TableHead>{isAr ? "التاريخ" : "Sent"}</TableHead>
                <TableHead>{isAr ? "التسليم" : "Delivered"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-sm">
                    {d.toPhone}
                  </TableCell>
                  <TableCell>{d.provider}</TableCell>
                  <TableCell>
                    <StatusBadge status={d.status} />
                  </TableCell>
                  <TableCell>{format(d.sentAt)}</TableCell>
                  <TableCell>{format(d.deliveredAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
