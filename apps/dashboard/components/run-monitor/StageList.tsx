"use client"

import type { RunStage, StageStatus, StageStatusUpdate } from "@/lib/types/runs"
import { cn } from "@/lib/utils"

interface StageListProps {
  stages: RunStage[]
  liveStageUpdates: Map<string, StageStatusUpdate>
  currentStageIndex: number
}

const STATUS_SYMBOLS: Record<StageStatus, string> = {
  PENDING: "○",
  RUNNING: "◐",
  PASSED: "✓",
  FAILED: "✗",
  SKIPPED: "○",
  RETRYING: "◐",
  PAUSED: "⏸",
}

const STATUS_STYLES: Record<StageStatus, { bg: string; text: string }> = {
  PENDING: { bg: "bg-muted/10", text: "text-muted-foreground" },
  RUNNING: { bg: "bg-info/10", text: "text-info" },
  PASSED: { bg: "bg-success/10", text: "text-success" },
  FAILED: { bg: "bg-destructive/10", text: "text-destructive" },
  SKIPPED: { bg: "bg-muted/10", text: "text-muted-foreground" },
  RETRYING: { bg: "bg-warning/10", text: "text-warning" },
  PAUSED: { bg: "bg-warning/10", text: "text-warning" },
}

function formatDuration(startedAt: string | null, endedAt: string | null): string {
  if (!startedAt) return "-"
  const start = new Date(startedAt).getTime()
  const end = endedAt ? new Date(endedAt).getTime() : Date.now()
  const diffMs = end - start
  const diffSec = Math.floor(diffMs / 1000)
  const minutes = Math.floor(diffSec / 60)
  const seconds = diffSec % 60
  if (minutes === 0) return `${seconds}s`
  return `${minutes}m ${seconds}s`
}

function getMergedStatus(
  stage: RunStage,
  liveUpdate?: StageStatusUpdate,
): StageStatus {
  return liveUpdate?.status ?? stage.status
}

export function StageList({ stages, liveStageUpdates, currentStageIndex }: StageListProps) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">Stages</h2>
      <div className="flex flex-col gap-2">
        {stages.map((stage, index) => {
          const liveUpdate = liveStageUpdates.get(stage.id)
          const status = getMergedStatus(stage, liveUpdate)
          const styles = STATUS_STYLES[status]
          const symbol = STATUS_SYMBOLS[status]
          const isCurrentStage = index === currentStageIndex

          return (
            <div
              key={stage.id}
              className={cn(
                "flex items-center justify-between rounded-lg border p-4 transition-colors",
                isCurrentStage && status === "RUNNING"
                  ? "border-info bg-info/5"
                  : "border-border bg-card",
                status === "PASSED" && "bg-success/5",
                status === "FAILED" && "bg-destructive/5",
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "text-lg font-bold",
                    styles.text,
                    isCurrentStage && status === "RUNNING" && "animate-pulse",
                  )}
                >
                  {symbol}
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{stage.agentName}</span>
                  <span className="text-xs text-muted-foreground">
                    {stage.agentId.slice(0, 8)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex flex-col items-end">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                      styles.bg,
                      styles.text,
                    )}
                  >
                    {status}
                  </span>
                  <span className="mt-1 text-xs text-muted-foreground">
                    {formatDuration(stage.startedAt, stage.endedAt)}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
