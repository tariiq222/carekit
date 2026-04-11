"use client"

/**
 * Widget Tab — extracted sub-components
 * CopyButton and ParamRow, shared by widget-tab.tsx
 */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { HugeiconsIcon } from "@hugeicons/react"
import { Copy01Icon, CheckmarkCircle01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

/* ─── Copy button ─── */

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="shrink-0 gap-1.5"
    >
      <HugeiconsIcon
        icon={copied ? CheckmarkCircle01Icon : Copy01Icon}
        size={14}
        className={cn(copied ? "text-success" : "text-muted-foreground")}
      />
      {copied ? label.replace(/^.*/, "✓") : label}
    </Button>
  )
}

/* ─── URL param row ─── */

export function ParamRow({
  name,
  description,
  required,
  requiredLabel,
  example,
}: {
  name: string
  description: string
  required?: boolean
  requiredLabel?: string
  example: string
}) {
  return (
    <div className="grid grid-cols-[140px_1fr_auto] gap-3 items-start py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-2">
        <code className="text-xs bg-surface-muted px-1.5 py-0.5 rounded-sm font-mono text-foreground">
          {name}
        </code>
        {required && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 text-error border-error/30">
            {requiredLabel ?? "Required"}
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      <code className="text-xs text-muted-foreground font-mono">{example}</code>
    </div>
  )
}
