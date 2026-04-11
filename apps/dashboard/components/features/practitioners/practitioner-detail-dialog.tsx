"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DetailSection, DetailRow } from "@/components/features/detail-sheet-parts"
import {
  usePractitioner,
  usePractitionerAvailability,
  usePractitionerBreaks,
  usePractitionerVacations,
  usePractitionerServices,
} from "@/hooks/use-practitioners"
import { useLocale } from "@/components/locale-provider"
import { useRouter } from "next/navigation"
import type { AvailabilitySlot, BreakSlot, Vacation, PractitionerService } from "@/lib/types/practitioner"

interface Props {
  practitionerId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DAY_NAMES_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
const DAY_NAMES_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

function ScheduleView({ slots, locale }: { slots: AvailabilitySlot[]; locale: "ar" | "en" }) {
  const days = locale === "ar" ? DAY_NAMES_AR : DAY_NAMES_EN
  const active = slots.filter((s) => s.isActive)
  if (!active.length) return <p className="text-sm text-muted-foreground">—</p>
  return (
    <div className="flex flex-col gap-2">
      {active.map((s) => (
        <div key={s.dayOfWeek} className="flex items-center justify-between text-sm">
          <span className="text-foreground">{days[s.dayOfWeek]}</span>
          <span className="tabular-nums text-muted-foreground">{s.startTime} – {s.endTime}</span>
        </div>
      ))}
    </div>
  )
}

function BreaksView({ breaks, locale }: { breaks: BreakSlot[]; locale: "ar" | "en" }) {
  const days = locale === "ar" ? DAY_NAMES_AR : DAY_NAMES_EN
  if (!breaks.length) return <p className="text-sm text-muted-foreground">—</p>
  return (
    <div className="flex flex-col gap-2">
      {breaks.map((b) => (
        <div key={`${b.dayOfWeek}-${b.startTime}`} className="flex items-center justify-between text-sm">
          <span className="text-foreground">{days[b.dayOfWeek]}</span>
          <span className="tabular-nums text-muted-foreground">{b.startTime} – {b.endTime}</span>
        </div>
      ))}
    </div>
  )
}

function VacationsView({ vacations }: { vacations: Vacation[] }) {
  if (!vacations.length) return <p className="text-sm text-muted-foreground">—</p>
  return (
    <div className="flex flex-col gap-2">
      {vacations.map((v) => (
        <div key={v.id} className="flex items-center justify-between text-sm">
          <span className="text-foreground">{v.reason ?? "—"}</span>
          <span className="tabular-nums text-muted-foreground">{v.startDate} – {v.endDate}</span>
        </div>
      ))}
    </div>
  )
}

function ServicesView({ services, locale }: { services: PractitionerService[]; locale: "ar" | "en" }) {
  const { t } = useLocale()
  if (!services.length) return <p className="text-sm text-muted-foreground">—</p>
  return (
    <div className="flex flex-col gap-2">
      {services.map((s) => (
        <div key={s.id} className="flex items-center justify-between text-sm">
          <span className="text-foreground">{locale === "ar" ? s.service.nameAr : s.service.nameEn}</span>
          <span className="tabular-nums text-muted-foreground">{s.service.price} {t("practitioners.services.sar")}</span>
        </div>
      ))}
    </div>
  )
}

export function PractitionerDetailDialog({ practitionerId, open, onOpenChange }: Props) {
  const { locale, t } = useLocale()
  const router = useRouter()
  const { data: p, isLoading } = usePractitioner(practitionerId)
  const { data: availability = [], isError: availabilityError } = usePractitionerAvailability(practitionerId)
  const { data: breaks = [], isError: breaksError } = usePractitionerBreaks(practitionerId)
  const { data: vacations = [], isError: vacationsError } = usePractitionerVacations(practitionerId)
  const { data: services = [], isError: servicesError } = usePractitionerServices(practitionerId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {isLoading || !p ? (
          <>
            <DialogHeader>
              <DialogTitle className="sr-only">Loading…</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 p-6">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <Avatar className="size-10 shrink-0">
                  {p.avatarUrl && <AvatarImage src={p.avatarUrl} alt={`${p.user.firstName} ${p.user.lastName}`} />}
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                    {p.user.firstName[0]}{p.user.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-1">
                  <DialogTitle>
                    {p.title ? `${p.title} ` : ""}{p.user.firstName} {p.user.lastName}
                  </DialogTitle>
                  {p.nameAr && (
                    <p className="text-xs text-muted-foreground">{p.nameAr}</p>
                  )}
                  <DialogDescription className="flex items-center gap-2">
                    <span dir="auto">{locale === "ar" ? (p.specialtyAr ?? p.specialty) : p.specialty}</span>
                    <Badge
                      variant="outline"
                      className={
                        p.isActive
                          ? "border-success/30 bg-success/10 text-success"
                          : "border-muted-foreground/30 bg-muted text-muted-foreground"
                      }
                    >
                      {p.isActive ? t("practitioners.status.active") : t("practitioners.status.suspended")}
                    </Badge>
                  </DialogDescription>
                  {p.averageRating != null && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      ★ {p.averageRating.toFixed(1)} ({p._count?.ratings ?? 0})
                    </span>
                  )}
                </div>
              </div>
            </DialogHeader>

            <Tabs defaultValue="info" dir={locale === "ar" ? "rtl" : "ltr"} className="flex flex-col overflow-hidden">
              <div className="px-6">
                <TabsList variant="line" className="w-full">
                  <TabsTrigger value="info">{t("detail.contact")}</TabsTrigger>
                  <TabsTrigger value="schedule">{t("practitioners.create.tabs.schedule")}</TabsTrigger>
                  <TabsTrigger value="services">{t("practitioners.create.tabs.services")}</TabsTrigger>
                  <TabsTrigger value="vacations">{t("practitioners.tabs.vacations")}</TabsTrigger>
                </TabsList>
              </div>

              <div className="overflow-y-auto max-h-[55vh]">
                <TabsContent value="info" className="m-0 p-6 flex flex-col gap-5">
                  <DetailSection title={t("detail.contact")}>
                    <DetailRow label={t("detail.email")} value={<span dir="ltr">{p.user.email}</span>} />
                    <DetailRow label={t("detail.phone")} value={<span dir="ltr">{p.user.phone ?? "—"}</span>} />
                  </DetailSection>
                  <Separator />
                  <DetailSection title={t("detail.professional")}>
                    <DetailRow
                      label={t("detail.experience")}
                      value={p.experience != null ? `${p.experience} ${t("common.years")}` : "—"}
                    />
                    <DetailRow
                      label={t("detail.education")}
                      value={(locale === "ar" ? p.educationAr : p.education) ?? "—"}
                    />
                    <DetailRow
                      label={t("detail.bio")}
                      value={(locale === "ar" ? p.bioAr : p.bio) ?? "—"}
                    />
                    <DetailRow
                      label={t("detail.joinedAt")}
                      value={new Date(p.createdAt).toLocaleDateString(
                        locale === "ar" ? "ar-SA" : "en-US",
                        { year: "numeric", month: "long", day: "numeric" }
                      )}
                    />
                  </DetailSection>
                </TabsContent>

                <TabsContent value="schedule" className="m-0 p-6 flex flex-col gap-5">
                  <DetailSection title={t("practitioners.create.tabs.schedule")}>
                    {availabilityError ? <p className="text-sm text-destructive">{t("common.errorLoading")}</p> : <ScheduleView slots={availability} locale={locale} />}
                  </DetailSection>
                  <Separator />
                  <DetailSection title={t("practitioners.breaks.title")}>
                    {breaksError ? <p className="text-sm text-destructive">{t("common.errorLoading")}</p> : <BreaksView breaks={breaks} locale={locale} />}
                  </DetailSection>
                </TabsContent>

                <TabsContent value="services" className="m-0 p-6">
                  <DetailSection title={t("practitioners.create.tabs.services")}>
                    {servicesError ? <p className="text-sm text-destructive">{t("common.errorLoading")}</p> : <ServicesView services={services} locale={locale} />}
                  </DetailSection>
                </TabsContent>

                <TabsContent value="vacations" className="m-0 p-6">
                  <DetailSection title={t("practitioners.tabs.vacations")}>
                    {vacationsError ? <p className="text-sm text-destructive">{t("common.errorLoading")}</p> : <VacationsView vacations={vacations} />}
                  </DetailSection>
                </TabsContent>
              </div>
            </Tabs>

            <DialogFooter>
              <Button
                onClick={() => {
                  onOpenChange(false)
                  router.push(`/practitioners/${p.id}/edit`)
                }}
              >
                {t("practitioners.detail.edit")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
