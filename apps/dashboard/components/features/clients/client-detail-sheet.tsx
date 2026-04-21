"use client"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetBody,
  SheetTitle,
} from "@carekit/ui"
import { Badge } from "@carekit/ui"
import { Separator } from "@carekit/ui"
import { Skeleton } from "@carekit/ui"
import { DetailSection, DetailRow } from "@/components/features/detail-sheet-parts"
import { useClient } from "@/hooks/use-clients"
import { useLocale } from "@/components/locale-provider"

interface ClientDetailSheetProps {
  clientId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ClientDetailSheet({
  clientId,
  open,
  onOpenChange,
}: ClientDetailSheetProps) {
  const { t, locale } = useLocale()
  const { data: client, isLoading } = useClient(clientId)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left">
        {isLoading || !client ? (
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
                {client.firstName} {client.lastName}
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    client.isActive
                      ? "border-success/30 bg-success/10 text-success"
                      : "border-muted-foreground/30 bg-muted text-muted-foreground"
                  }
                >
                  {client.isActive
                    ? t("clients.status.active")
                    : t("clients.status.inactive")}
                </Badge>
              </SheetDescription>
            </SheetHeader>

            <SheetBody>
              <div className="flex flex-col gap-6">
                {/* Contact Info */}
                <DetailSection title={t("clients.detail.contactInfo")}>
                  <DetailRow
                    label={t("clients.detail.email")}
                    value={client.email}
                  />
                  <DetailRow
                    label={t("clients.detail.phone")}
                    value={client.phone ?? "—"}
                  />
                  <DetailRow
                    label={t("clients.detail.gender")}
                    value={
                      client.gender
                        ? t(`clients.create.${client.gender}`)
                        : "—"
                    }
                  />
                  <DetailRow
                    label={t("clients.detail.joined")}
                    value={new Date(client.createdAt).toLocaleDateString()}
                    numeric
                  />
                </DetailSection>

                <Separator />

                {/* Stats */}
                <DetailSection title={t("clients.detail.statistics")}>
                  <p className="text-sm text-muted-foreground">
                    —
                  </p>
                </DetailSection>
              </div>
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
