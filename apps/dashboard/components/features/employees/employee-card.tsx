"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  ViewIcon,
  PencilEdit01Icon,
  StarIcon,
} from "@hugeicons/core-free-icons"

import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn, formatName, getInitials, getAvatarGradientStyle } from "@/lib/utils"
import { useLocale } from "@/components/locale-provider"
import type { Practitioner } from "@/lib/types/practitioner"

interface PractitionerCardProps {
  practitioner: Practitioner
  onView: (p: Practitioner) => void
  onEdit: (p: Practitioner) => void
}


function _StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <HugeiconsIcon
            key={i}
            icon={StarIcon}
            size={16}
            className={cn(
              i < Math.round(rating)
                ? "text-warning fill-warning"
                : "text-border"
            )}
          />
        ))}
      </div>
      <span className="text-sm font-bold tabular-nums text-foreground">
        {rating.toFixed(1)}
      </span>
    </div>
  )
}

export function PractitionerCard({
  practitioner: p,
  onView,
  onEdit,
}: PractitionerCardProps) {
  const { locale, t } = useLocale()
  const name = formatName(p.user.firstName, p.user.lastName)
  const initials = getInitials(p.user.firstName, p.user.lastName)
  const specialty = locale === "ar" ? (p.specialtyAr || p.specialty) : p.specialty
  const rating = p.averageRating ?? 0
  const reviewCount = p._count?.ratings ?? 0
  const bookingsCount = p._count?.bookings ?? 0

  return (
    <Card className="card-lift group relative flex flex-col overflow-hidden">
      {/* Top gradient bar on hover */}
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-l from-primary to-primary/60 opacity-0 transition-opacity group-hover:opacity-100" />

      {/* Header: Avatar + Name + Status */}
      <div className="flex items-center gap-3 p-4 pb-3">
        <Avatar className="size-10 shrink-0">
          <AvatarFallback
            className="text-sm font-bold text-primary-foreground"
            style={getAvatarGradientStyle(p.id)}
          >
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground leading-tight">{name}</p>
          <p className="truncate text-xs text-muted-foreground mt-0.5">
            {specialty ?? "—"}
          </p>
        </div>

        <Badge
          variant="outline"
          className={cn(
            "shrink-0 gap-1 text-[10px] px-1.5 py-0.5",
            p.isActive
              ? "border-success/30 bg-success/10 text-success"
              : "border-muted-foreground/30 bg-muted text-muted-foreground"
          )}
        >
          <span className={cn(
            "size-1.5 rounded-full",
            p.isActive ? "bg-success" : "bg-muted-foreground"
          )} />
          {p.isActive
            ? t("practitioners.card.active")
            : t("practitioners.card.inactive")}
        </Badge>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-border" />

      {/* Stats Row */}
      <div className="flex items-center px-4 py-3 gap-3">
        {/* Rating */}
        <div className="flex items-center gap-1.5 flex-1">
          <HugeiconsIcon icon={StarIcon} size={14} className="text-warning fill-warning shrink-0" />
          <span className="text-sm font-semibold tabular-nums text-foreground">{rating.toFixed(1)}</span>
          <span className="text-xs text-muted-foreground tabular-nums">({reviewCount})</span>
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Bookings */}
        <div className="flex items-center gap-1.5 flex-1 justify-end">
          <span className="text-xs text-muted-foreground">{t("practitioners.card.monthBookings")}</span>
          <span className="text-sm font-semibold tabular-nums text-foreground">{bookingsCount}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 pb-4">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 gap-1.5 rounded-[10px] bg-primary/8 text-primary hover:bg-primary hover:text-primary-foreground h-8 text-xs"
          onClick={() => onView(p)}
        >
          <HugeiconsIcon icon={ViewIcon} size={14} />
          {t("practitioners.card.viewProfile")}
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          className="rounded-[10px] size-8"
          title={t("practitioners.detail.edit")}
          onClick={() => onEdit(p)}
        >
          <HugeiconsIcon icon={PencilEdit01Icon} size={14} />
        </Button>
      </div>
    </Card>
  )
}
