/**
 * Run Types — MultiAgent Control Panel
 */

export type RunStatus =
  | "PENDING"
  | "RUNNING"
  | "PASSED"
  | "FAILED"
  | "CANCELLED"
  | "PAUSED"

export type StageStatus =
  | "PENDING"
  | "RUNNING"
  | "PASSED"
  | "FAILED"
  | "SKIPPED"
  | "RETRYING"
  | "PAUSED"

export interface Run {
  id: string
  projectId: string
  pipelineName: string
  status: RunStatus
  currentStageIndex: number
  startedAt: string
  endedAt: string | null
  stages: RunStage[]
}

export interface RunStage {
  id: string
  agentId: string
  agentName: string
  status: StageStatus
  startedAt: string | null
  endedAt: string | null
  output?: string
}

export interface LogLine {
  runId: string
  line: string
  timestamp: string
  stageId?: string
}

export interface RunStatusEvent {
  runId: string
  status: RunStatus
  currentStageIndex?: number
}

export interface StageStatusEvent {
  runId: string
  stageId: string
  status: StageStatus
  agentId?: string
}

export interface StageStatusUpdate {
  stageId: string
  status: StageStatus
  agentId?: string
}
