"use client"

import { cn } from "@/lib/utils"
import type { Run, RunStatus } from "@/lib/types/runs"

interface RunHeaderProps {
  run: Run
  liveStatus: RunStatus | null
  onPause: () => void
  onCancel: () => void
  isPausing?: boolean
  isCancelling?: boolean
}

const STATUS_STYLES: Record<RunStatus, { bg: string; text: string; border: string }> = {
  PENDING: { bg: "bg-muted/10", text: "text-muted-foreground", border: "border-muted" },
  RUNNING: { bg: "bg-info/10", text: "text-info", border: "border-info" },
  PASSED: { bg: "bg-success/10", text: "text-success", border: "border-success" },
  FAILED: { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive" },
  CANCELLED: { bg: "bg-warning/10", text: "text-warning", border: "border-warning" },
  PAUSED: { bg: "bg-warning/10", text: "text-warning", border: "border-warning" },
}

function formatDuration(startedAt: string, endedAt: string | null): string {
  const start = new Date(startedAt).getTime()
  const end = endedAt ? new Date(endedAt).getTime() : Date.now()
  const diffMs = end - start
  const diffSec = Math.floor(diffMs / 1000)
  const minutes = Math.floor(diffSec / 60)
  const seconds = diffSec % 60
  return `${minutes}m ${seconds}s`
}

function formatStartTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

export function RunHeader({
  run,
  liveStatus,
  onPause,
  onCancel,
  isPausing = false,
  isCancelling = false,
}: RunHeaderProps) {
  const status = liveStatus ?? run.status
  const styles = STATUS_STYLES[status]
  const isRunning = status === "RUNNING"
  const isTerminal = ["PASSED", "FAILED", "CANCELLED"].includes(status)

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-muted-foreground">
              {run.id.slice(0, 8)}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                styles.bg,
                styles.text,
                styles.border,
              )}
            >
              {status}
            </span>
          </div>
          <h1 className="text-lg font-semibold">{run.pipelineName}</h1>
          <p className="text-sm text-muted-foreground">
            Project: <span className="font-medium text-foreground">{run.projectId}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onPause}
            disabled={!isRunning || isPausing}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition-colors",
              "hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {isPausing ? "Pausing..." : "Pause"}
          </button>
          <button
            onClick={onCancel}
            disabled={isTerminal || isCancelling}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive transition-colors",
              "hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {isCancelling ? "Cancelling..." : "Cancel"}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Started:</span>
          <span className="font-medium text-foreground">{formatStartTime(run.startedAt)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Duration:</span>
          <span className="font-medium text-foreground">
            {formatDuration(run.startedAt, run.endedAt)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span>Stage:</span>
          <span className="font-medium text-foreground">
            {run.currentStageIndex !== undefined ? run.currentStageIndex + 1 : "-"} /{" "}
            {run.stages.length}
          </span>
        </div>
      </div>
    </div>
  )
}
