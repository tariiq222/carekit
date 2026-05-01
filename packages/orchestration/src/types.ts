export const DEFAULT_WORKFLOW = [
  'OPUS_PLAN',
  'GPT_REVIEW',
  'OPUS_FINALIZE',
  'SONNET_EXECUTE',
  'RUN_CHECKS',
  'DECIDE',
  'FINAL_REVIEW',
] as const

export type DefaultWorkflowPhase = (typeof DEFAULT_WORKFLOW)[number]

export type WorkflowPhase =
  | DefaultWorkflowPhase
  | 'SONNET_FIX'
  | 'OPUS_REANALYZE'

export type WorkflowStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'needs_opus_reanalysis'

export type RiskLevel = 'low' | 'medium' | 'high'

export interface RiskAssessment {
  level: RiskLevel
  reasons: string[]
}

export type ReviewDecision = 'APPROVE' | 'APPROVE_WITH_NOTES' | 'REVISE'

export interface PlanOutput {
  scope: string
  targetFiles: string[]
  executionPlan: string[]
  risks: string[]
  verificationCommands: string[]
  outOfScope: string[]
}

export interface GptReviewOutput {
  decision: ReviewDecision
  missingItems: string[]
  risks: string[]
  recommendations: string[]
}

export interface ExecutionOutput {
  changedFiles: string[]
  summary: string
  verificationCommands: string[]
  assumptions: string[]
}

export interface FinalReviewOutput {
  decision: ReviewDecision | 'BLOCK'
  risks: string[]
  recommendations: string[]
}

export interface CommandResult {
  command: string
  exitCode: number
  stdout: string
  stderr: string
  durationMs: number
}

export interface RunChecksResult {
  passed: boolean
  results: CommandResult[]
}

export interface WorkflowPhaseRecord {
  phase: WorkflowPhase
  status: 'started' | 'completed' | 'failed'
  startedAt: string
  completedAt?: string
  output?: unknown
  error?: string
}

export interface WorkflowState {
  id: string
  request: string
  risk: RiskAssessment
  status: WorkflowStatus
  currentPhase?: WorkflowPhase
  retries: number
  startedAt: string
  updatedAt: string
  logDir?: string
  opusPlan?: PlanOutput
  gptReview?: GptReviewOutput
  finalPlan?: PlanOutput
  executionResult?: ExecutionOutput
  checkResult?: RunChecksResult
  testResult?: RunChecksResult
  finalReview?: FinalReviewOutput
  phases: WorkflowPhaseRecord[]
}

export interface ModelContext {
  [key: string]: unknown
}

export interface ClaudeCodeClient {
  sendToClaudeCode(
    model: string,
    prompt: string,
    context?: ModelContext,
  ): Promise<string>
}

export interface GptModelClient {
  send(model: string, prompt: string, context?: ModelContext): Promise<string>
}

export interface ChecksRunner {
  runCommands(commands: string[]): Promise<RunChecksResult>
}

export interface PromptStore {
  getTemplate(name: string): Promise<string>
}
