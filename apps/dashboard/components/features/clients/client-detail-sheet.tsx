"use client"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetBody,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { DetailSection, DetailRow } from "@/components/features/detail-sheet-parts"
import { usePatient, usePatientStats } from "@/hooks/use-patients"
import { useLocale } from "@/components/locale-provider"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"

interface PatientDetailSheetProps {
  patientId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PatientDetailSheet({
  patientId,
  open,
  onOpenChange,
}: PatientDetailSheetProps) {
  const { t, locale } = useLocale()
  const { data: patient, isLoading } = usePatient(patientId)
  const { data: stats, isLoading: statsLoading } = usePatientStats(patientId)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left">
        {isLoading || !patient ? (
          <SheetBody>
            <div className="flex flex-col gap-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
              <Separator />
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          </SheetBody>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>
                {patient.firstName} {patient.lastName}
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    patient.isActive
                      ? "border-success/30 bg-success/10 text-success"
                      : "border-muted-foreground/30 bg-muted text-muted-foreground"
                  }
                >
                  {patient.isActive
                    ? t("patients.status.active")
                    : t("patients.status.inactive")}
                </Badge>
              </SheetDescription>
            </SheetHeader>

            <SheetBody>
              <div className="flex flex-col gap-6">
                {/* Contact Info */}
                <DetailSection title={t("patients.detail.contactInfo")}>
                  <DetailRow
                    label={t("patients.detail.email")}
                    value={patient.email}
                  />
                  <DetailRow
                    label={t("patients.detail.phone")}
                    value={patient.phone ?? "—"}
                  />
                  <DetailRow
                    label={t("patients.detail.gender")}
                    value={
                      patient.gender
                        ? t(`patients.create.${patient.gender}`)
                        : "—"
                    }
                  />
                  <DetailRow
                    label={t("patients.detail.joined")}
                    value={new Date(patient.createdAt).toLocaleDateString()}
                    numeric
                  />
                </DetailSection>

                <Separator />

                {/* Stats */}
                <DetailSection title={t("patients.detail.statistics")}>
                  {statsLoading || !stats ? (
                    <div className="flex flex-col gap-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-5 w-full" />
                      ))}
                    </div>
                  ) : (
                    <>
                      <DetailRow
                        label={t("patients.detail.totalBookings")}
                        value={String(stats.totalBookings)}
                        numeric
                      />
                      <DetailRow
                        label={t("patients.detail.completed")}
                        value={String(stats.completedBookings)}
                        numeric
                      />
                      <DetailRow
                        label={t("patients.detail.cancelled")}
                        value={String(stats.cancelledBookings)}
                        numeric
                      />
                      <DetailRow
                        label={t("patients.detail.totalSpent")}
                        value={<FormattedCurrency amount={stats.totalSpent} locale={locale} decimals={2} />}
                        numeric
                      />
                      <DetailRow
                        label={t("patients.detail.lastVisit")}
                        value={
                          stats.lastVisit
                            ? new Date(stats.lastVisit).toLocaleDateString()
                            : "—"
                        }
                        numeric
                      />
                    </>
                  )}
                </DetailSection>
              </div>
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
