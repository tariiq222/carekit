"use client"

import { useMemo } from "react"
import { ReactFlow, type Node, type Edge } from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import type { RunStage, StageStatus, StageStatusUpdate } from "@/lib/types/runs"
import { cn } from "@/lib/utils"

interface PipelineGraphProps {
  stages: RunStage[]
  liveStageUpdates: Map<string, StageStatusUpdate>
  currentStageIndex: number
}

const STATUS_COLORS: Record<StageStatus, { bg: string; border: string; text: string }> = {
  PENDING: { bg: "#1e1e2e", border: "#2a2a3a", text: "#98a2b3" },
  RUNNING: { bg: "#3730a3", border: "#6366f1", text: "#ffffff" },
  PASSED: { bg: "#14532d", border: "#22c55e", text: "#ffffff" },
  FAILED: { bg: "#7f1d1d", border: "#ef4444", text: "#ffffff" },
  PAUSED: { bg: "#78350f", border: "#f59e0b", text: "#ffffff" },
  SKIPPED: { bg: "#1e1e2e", border: "#4b5563", text: "#6b7280" },
  RETRYING: { bg: "#1e1e2e", border: "#f59e0b", text: "#f59e0b" },
}

function getMergedStatus(
  stage: RunStage,
  liveUpdate?: StageStatusUpdate,
): StageStatus {
  return liveUpdate?.status ?? stage.status
}

export function PipelineGraph({ stages, liveStageUpdates, currentStageIndex }: PipelineGraphProps) {
  const { nodes, edges } = useMemo(() => {
    const nodeList: Node[] = stages.map((stage, index) => {
      const liveUpdate = liveStageUpdates.get(stage.id)
      const status = getMergedStatus(stage, liveUpdate)
      const colors = STATUS_COLORS[status]
      const isActive = index === currentStageIndex && status === "RUNNING"

      return {
        id: stage.id,
        position: { x: index * 220, y: 0 },
        data: { label: stage.agentName },
        style: {
          background: colors.bg,
          border: `2px solid ${colors.border}`,
          borderRadius: "8px",
          padding: "12px 16px",
          minWidth: "160px",
          color: colors.text,
          boxShadow: isActive ? `0 0 20px ${colors.border}40` : undefined,
        },
      }
    })

    const edgeList: Edge[] = stages.slice(0, -1).map((stage, index) => ({
      id: `e${stage.id}-${stages[index + 1].id}`,
      source: stage.id,
      target: stages[index + 1].id,
      style: { stroke: "#4b5563", strokeWidth: 2 },
      arrowHeadType: "arrowclosed" as const,
    }))

    return { nodes: nodeList, edges: edgeList }
  }, [stages, liveStageUpdates, currentStageIndex])

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-muted-foreground">Pipeline</h2>
      <div
        className="overflow-x-auto rounded-lg border border-border"
        style={{ height: "200px" }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={true}
          zoomOnScroll={true}
          proOptions={{ hideAttribution: true }}
        />
      </div>
    </div>
  )
}
