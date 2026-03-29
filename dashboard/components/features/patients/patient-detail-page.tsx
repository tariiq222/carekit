"use client"

import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  PencilEdit01Icon,
  Calendar01Icon,
  MoneyBag01Icon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
  ArrowLeft01Icon,
} from "@hugeicons/core-free-icons"

import { ListPageShell } from "@/components/features/list-page-shell"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { StatsGrid } from "@/components/features/stats-grid"
import { StatCard } from "@/components/features/stat-card"
import { DetailSection, DetailRow } from "@/components/features/detail-sheet-parts"
import { ErrorBanner } from "@/components/features/error-banner"
import { PatientBookingRow } from "@/components/features/patients/patient-booking-row"
import { PatientInvoiceRow } from "@/components/features/patients/patient-invoice-row"
import { PatientPageSkeleton } from "@/components/features/patients/patient-page-skeleton"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLocale } from "@/components/locale-provider"
import { usePatient, usePatientStats, usePatientBookings } from "@/hooks/use-patients"

/* ─── Props ─── */

interface Props {
  patientId: string
}

/* ─── Component ─── */

export function PatientDetailPage({ patientId }: Props) {
  const router = useRouter()
  const { locale, t } = useLocale()

  const { data: patient, isLoading, error } = usePatient(patientId)
  const { data: stats, isLoading: statsLoading } = usePatientStats(patientId)
  const { data: bookingsData, isLoading: bookingsLoading } = usePatientBookings(patientId)

  const allBookings = bookingsData?.items ?? []

  if (isLoading) return <PatientPageSkeleton />

  if (error || !patient) {
    return (
      <ListPageShell>
        <Breadcrumbs />
        <ErrorBanner message={t("patients.detail.notFound")} />
        <Button variant="outline" onClick={() => router.push("/patients")}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
          {t("patients.detail.backToPatients")}
        </Button>
      </ListPageShell>
    )
  }

  const fullName = [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(" ")

  return (
    <ListPageShell>
      <Breadcrumbs items={[
        { label: t("nav.dashboard"), href: "/" },
        { label: t("nav.patients"), href: "/patients" },
        { label: fullName },
      ]} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="size-12 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {patient.firstName[0]}{patient.lastName[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{fullName}</h1>
              {patient.accountType === "walk_in" && (
                <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
                  {t("patients.detail.walkIn")}
                </Badge>
              )}
              <Badge
                variant="outline"
                className={
                  patient.isActive
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-muted-foreground/30 bg-muted text-muted-foreground"
                }
              >
                {patient.isActive ? t("patients.detail.active") : t("patients.detail.inactive")}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{patient.email}</p>
          </div>
        </div>
        <Button
          className="gap-2 rounded-full px-5"
          onClick={() => router.push(`/patients/${patientId}/edit`)}
        >
          <HugeiconsIcon icon={PencilEdit01Icon} size={16} />
          {t("patients.detail.edit")}
        </Button>
      </div>

      <Tabs defaultValue="info" dir={locale === "ar" ? "rtl" : "ltr"}>
        <TabsList variant="line">
          <TabsTrigger value="info">{t("patients.dialog.tabs.contact")}</TabsTrigger>
          <TabsTrigger value="bookings">{t("patients.dialog.tabs.bookings")}</TabsTrigger>
          <TabsTrigger value="invoices">{t("patients.dialog.tabs.invoices")}</TabsTrigger>
          <TabsTrigger value="stats">{t("patients.dialog.tabs.stats")}</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: التواصل والبيانات ── */}
        <TabsContent value="info" className="pt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="pt-6">
                <DetailSection title={t("patients.detail.personalInfo")}>
                  <DetailRow label={t("patients.detail.fullName")} value={fullName} />
                  <DetailRow
                    label={t("patients.detail.gender")}
                    value={patient.gender
                      ? t(patient.gender === "male" ? "patients.detail.male" : "patients.detail.female")
                      : "—"}
                  />
                  <DetailRow
                    label={t("patients.detail.dateOfBirth")}
                    value={patient.dateOfBirth
                      ? new Date(patient.dateOfBirth).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US")
                      : "—"}
                    numeric
                  />
                  <DetailRow label={t("patients.detail.nationality")} value={patient.nationality ?? "—"} />
                  <DetailRow label={t("patients.detail.nationalId")} value={patient.nationalId ?? "—"} numeric />
                </DetailSection>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <DetailSection title={t("patients.detail.contactInfo")}>
                  <DetailRow label={t("patients.detail.email")} value={<span dir="ltr">{patient.email}</span>} />
                  <DetailRow label={t("patients.detail.phone")} value={<span dir="ltr">{patient.phone ?? "—"}</span>} />
                </DetailSection>
                <Separator className="my-4" />
                <DetailSection title={t("patients.detail.emergencyContact")}>
                  <DetailRow label={t("patients.detail.name")} value={patient.emergencyName ?? "—"} />
                  <DetailRow label={t("patients.detail.phone")} value={<span dir="ltr">{patient.emergencyPhone ?? "—"}</span>} />
                </DetailSection>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <DetailSection title={t("patients.detail.medicalInfo")}>
                  <DetailRow label={t("patients.detail.bloodType")} value={patient.bloodType ?? "—"} />
                  <DetailRow label={t("patients.detail.allergies")} value={patient.allergies ?? "—"} />
                  <DetailRow label={t("patients.detail.chronicConditions")} value={patient.chronicConditions ?? "—"} />
                </DetailSection>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <DetailSection title={t("patients.detail.accountInfo")}>
                  <DetailRow
                    label={t("patients.detail.registeredDate")}
                    value={new Date(patient.createdAt).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US")}
                    numeric
                  />
                  <DetailRow
                    label={t("patients.detail.lastUpdated")}
                    value={new Date(patient.updatedAt).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US")}
                    numeric
                  />
                  {patient.accountType === "walk_in" && (
                    <>
                      <DetailRow
                        label={t("patients.detail.accountType")}
                        value={
                          <span className="rounded-sm bg-warning/10 px-1.5 py-0.5 text-xs font-medium text-warning">
                            {t("patients.detail.walkIn")}
                          </span>
                        }
                      />
                      <DetailRow
                        label={t("patients.detail.claimedAt")}
                        value={patient.claimedAt
                          ? new Date(patient.claimedAt).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US")
                          : t("patients.detail.notClaimed")}
                        numeric={!!patient.claimedAt}
                      />
                    </>
                  )}
                </DetailSection>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Tab 2: المواعيد ── */}
        <TabsContent value="bookings" className="pt-4">
          <Card>
            <CardContent className="pt-6">
              {bookingsLoading ? (
                <div className="flex flex-col gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 rounded-lg" />
                  ))}
                </div>
              ) : allBookings.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t("patients.dialog.noBookings")}
                </p>
              ) : (
                allBookings.map((b) => (
                  <PatientBookingRow key={b.id} booking={b} locale={locale} t={t} />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 3: الفواتير ── */}
        <TabsContent value="invoices" className="pt-4">
          <Card>
            <CardContent className="pt-6">
              {bookingsLoading ? (
                <div className="flex flex-col gap-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 rounded-lg" />
                  ))}
                </div>
              ) : allBookings.filter((b) => b.payment !== null).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t("patients.dialog.noInvoices")}
                </p>
              ) : (
                allBookings.filter((b) => b.payment !== null).map((b) => (
                  <PatientInvoiceRow key={b.id} booking={b} locale={locale} t={t} />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 4: الإحصائيات ── */}
        <TabsContent value="stats" className="pt-4">
          {statsLoading || !stats ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[130px] rounded-xl" />
              ))}
            </div>
          ) : (
            <StatsGrid>
              <StatCard
                title={t("patients.detail.totalBookings")}
                value={stats.totalBookings}
                icon={Calendar01Icon}
                iconColor="primary"
              />
              <StatCard
                title={t("patients.detail.completed")}
                value={stats.byStatus?.["completed"] ?? stats.completedBookings ?? 0}
                icon={CheckmarkCircle01Icon}
                iconColor="success"
              />
              <StatCard
                title={t("patients.detail.cancelled")}
                value={stats.byStatus?.["cancelled"] ?? stats.cancelledBookings ?? 0}
                icon={Cancel01Icon}
                iconColor="warning"
              />
              <StatCard
                title={t("patients.detail.totalPaid")}
                value={<FormattedCurrency amount={stats.totalPaid ?? stats.totalSpent ?? 0} locale={locale} decimals={2} />}
                icon={MoneyBag01Icon}
                iconColor="accent"
              />
            </StatsGrid>
          )}
        </TabsContent>
      </Tabs>
    </ListPageShell>
  )
}
