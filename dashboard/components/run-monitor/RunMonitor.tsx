"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { fetchRun, pauseRun, cancelRun } from "@/lib/api/runs"
import { useRunSocket, TERMINAL_STATUSES } from "@/hooks/use-run-socket"
import type { Run, RunStatus } from "@/lib/types/runs"
import { RunHeader } from "./RunHeader"
import { PipelineGraph } from "./PipelineGraph"
import { StageList } from "./StageList"
import { LogTerminal } from "./LogTerminal"
import { cn } from "@/lib/utils"

interface RunMonitorProps {
  projectId: string
  runId: string
}

function isTerminalStatus(status: RunStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}

export function RunMonitor({ projectId, runId }: RunMonitorProps) {
  const queryClient = useQueryClient()

  const { data: run, isLoading, error } = useQuery({
    queryKey: queryKeys.runs.detail(runId),
    queryFn: () => fetchRun(runId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (!status || isTerminalStatus(status)) return false
      return 2000
    },
  })

  const { logLines, runStatus, currentStageIndex, stageUpdates } = useRunSocket({
    runId,
    enabled: !!run && !isTerminalStatus(run.status),
  })

  const pauseMutation = useMutation({
    mutationFn: () => pauseRun(runId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.runs.detail(runId) })
    },
    onError: (err) => {
      console.error("Failed to pause run:", err)
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () => cancelRun(runId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.runs.detail(runId) })
    },
    onError: (err) => {
      console.error("Failed to cancel run:", err)
    },
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex animate-pulse flex-col gap-4 rounded-xl border border-border bg-card p-6">
          <div className="h-6 w-32 rounded bg-muted" />
          <div className="h-4 w-48 rounded bg-muted" />
        </div>
        <div className="h-[200px] animate-pulse rounded-lg border border-border bg-card" />
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg border border-border bg-card" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !run) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-12">
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load run"}
        </p>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.runs.detail(runId) })}
          className="text-sm text-primary hover:underline"
        >
          Try again
        </button>
      </div>
    )
  }

  const liveStatus = runStatus ?? run.status
  const liveStageIndex = currentStageIndex ?? run.currentStageIndex

  return (
    <div className="flex flex-col gap-6">
      <RunHeader
        run={run}
        liveStatus={liveStatus}
        onPause={() => pauseMutation.mutate()}
        onCancel={() => cancelMutation.mutate()}
        isPausing={pauseMutation.isPending}
        isCancelling={cancelMutation.isPending}
      />

      <PipelineGraph
        stages={run.stages}
        liveStageUpdates={stageUpdates}
        currentStageIndex={liveStageIndex}
      />

      <StageList
        stages={run.stages}
        liveStageUpdates={stageUpdates}
        currentStageIndex={liveStageIndex}
      />

      <LogTerminal lines={logLines} />
    </div>
  )
}
