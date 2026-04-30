"use client"

import Link from "next/link"
import { useLocale } from "@/components/locale-provider"
import { HugeiconsIcon } from "@hugeicons/react"
import { Card } from "@deqah/ui"
import { cn } from "@/lib/utils"
import type { IconSvgElement } from "@hugeicons/react"

interface QuickAction {
  titleKey: string
  descriptionKey: string
  icon: IconSvgElement
  href: string
  color: "primary" | "success" | "warning" | "info"
}

interface QuickActionsProps {
  actions: QuickAction[]
}

const colorMap: Record<QuickAction["color"], string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  info: "bg-accent/10 text-accent-foreground",
}

export function QuickActions({ actions }: QuickActionsProps) {
  const { t } = useLocale()

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {actions.map((action) => (
        <Link key={action.titleKey} href={action.href}>
          <Card className="card-lift flex cursor-pointer flex-col gap-3 p-4 transition-colors hover:bg-muted/50">
            <div className={cn("flex size-10 items-center justify-center rounded-[10px]", colorMap[action.color])}>
              <HugeiconsIcon icon={action.icon} size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold">{t(action.titleKey)}</p>
              <p className="text-xs text-muted-foreground">{t(action.descriptionKey)}</p>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  )
}
