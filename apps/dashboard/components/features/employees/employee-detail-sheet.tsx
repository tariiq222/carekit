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
import { usePractitioner } from "@/hooks/use-practitioners"
import { useLocale } from "@/components/locale-provider"
import { ScheduleSection } from "./schedule-section"
import { VacationManager } from "./vacation-manager"
import { PractitionerServicesSection } from "./practitioner-services-section"
import { PractitionerRatings } from "./practitioner-ratings"

interface Props {
  practitionerId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PractitionerDetailSheet({
  practitionerId,
  open,
  onOpenChange,
}: Props) {
  const { locale, t } = useLocale()
  const { data: p, isLoading } = usePractitioner(practitionerId)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left">
        {isLoading || !p ? (
          <SheetBody>
            <div className="flex flex-col gap-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
              <Separator />
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          </SheetBody>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>
                {p.user.firstName} {p.user.lastName}
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2">
                <span>
                  {p.specialty}
                </span>
                <Badge
                  variant="outline"
                  className={
                    p.isActive
                      ? "border-success/30 bg-success/10 text-success"
                      : "border-muted-foreground/30 bg-muted text-muted-foreground"
                  }
                >
                  {p.isActive ? t("common.active") : t("common.inactive")}
                </Badge>
              </SheetDescription>
            </SheetHeader>

            <SheetBody>
              <div className="flex flex-col gap-6">
                <DetailSection title={t("detail.contact")}>
                  <DetailRow label={t("detail.email")} value={p.user.email} />
                  <DetailRow label={t("detail.phone")} value={p.user.phone ?? "—"} />
                </DetailSection>

                <Separator />

                <DetailSection title={t("detail.professional")}>
                  <DetailRow
                    label={t("detail.experience")}
                    value={
                      p.experience != null ? `${p.experience} ${t("common.years")}` : "—"
                    }
                  />
                  <DetailRow
                    label={t("detail.education")}
                    value={
                      (locale === "ar" ? p.educationAr : p.education) ?? "—"
                    }
                  />
                  <DetailRow
                    label={t("detail.bio")}
                    value={(locale === "ar" ? p.bioAr : p.bio) ?? "—"}
                  />
                </DetailSection>

                <Separator />

                <DetailSection title={t("detail.pricing")}>
                  <DetailRow
                    label={t("detail.clinicVisit")}
                    value={
                      p.priceClinic != null
                        ? (p.priceClinic / 100).toFixed(2)
                        : "—"
                    }
                    numeric
                  />
                  <DetailRow
                    label={t("detail.phoneConsultation")}
                    value={
                      p.pricePhone != null
                        ? (p.pricePhone / 100).toFixed(2)
                        : "—"
                    }
                    numeric
                  />
                  <DetailRow
                    label={t("detail.videoConsultation")}
                    value={
                      p.priceVideo != null
                        ? (p.priceVideo / 100).toFixed(2)
                        : "—"
                    }
                    numeric
                  />
                </DetailSection>

                <Separator />

                <PractitionerServicesSection practitionerId={p.id} />

                <Separator />

                <ScheduleSection practitionerId={p.id} />

                <Separator />

                <VacationManager practitionerId={p.id} />

                <Separator />

                <PractitionerRatings practitionerId={p.id} />
              </div>
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
