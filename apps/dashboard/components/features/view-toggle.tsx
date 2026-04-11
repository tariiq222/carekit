"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { GridIcon, Menu02Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ViewMode = "grid" | "list"

interface ViewToggleProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}

export function ViewToggle({ viewMode, onViewModeChange }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-1 rounded-md bg-muted/50 p-1">
      <Button
        variant="ghost"
        size="icon-sm"
        className={cn(
          viewMode === "grid" &&
            "bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground"
        )}
        onClick={() => onViewModeChange("grid")}
      >
        <HugeiconsIcon icon={GridIcon} size={16} />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className={cn(
          viewMode === "list" &&
            "bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground"
        )}
        onClick={() => onViewModeChange("list")}
      >
        <HugeiconsIcon icon={Menu02Icon} size={16} />
      </Button>
    </div>
  )
}
