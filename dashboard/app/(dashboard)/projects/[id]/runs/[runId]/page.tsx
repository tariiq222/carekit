"use client"

import { useParams } from "next/navigation"
import { RunMonitor } from "@/components/run-monitor/RunMonitor"

export default function RunDetailPage() {
  const { id: projectId, runId } = useParams<{ id: string; runId: string }>()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="text-sm text-muted-foreground">
          Projects &rsaquo; {projectId} &rsaquo; Runs &rsaquo; {runId.slice(0, 8)}
        </div>
      </div>
      <RunMonitor projectId={projectId} runId={runId} />
    </div>
  )
}
