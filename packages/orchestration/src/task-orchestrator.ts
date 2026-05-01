import { randomUUID } from 'node:crypto'

import { DEFAULT_VERIFICATION_COMMANDS, PROMPT_NAMES } from './constants.js'
import { ExecutionRunner } from './execution-runner.js'
import { parseJsonObject } from './json.js'
import { ModelRouter } from './model-router.js'
import { FilePromptStore, renderPrompt } from './prompt-store.js'
import { RetryPolicy } from './retry-policy.js'
import { RiskClassifier } from './risk-classifier.js'
import { WorkflowStateStore } from './state-store.js'
import type {
  ChecksRunner,
  ClaudeCodeClient,
  ExecutionOutput,
  FinalReviewOutput,
  GptModelClient,
  GptReviewOutput,
  PlanOutput,
  PromptStore,
  RunChecksResult,
  WorkflowPhase,
  WorkflowState,
} from './types.js'

export interface TaskOrchestratorOptions {
  claude: ClaudeCodeClient
  gpt: GptModelClient
  checksRunner?: ChecksRunner
  modelRouter?: ModelRouter
  promptStore?: PromptStore
  retryPolicy?: RetryPolicy
  riskClassifier?: RiskClassifier
  stateStore?: WorkflowStateStore
  persistState?: boolean
}

export class TaskOrchestrator {
  private readonly checksRunner: ChecksRunner
  private readonly modelRouter: ModelRouter
  private readonly promptStore: PromptStore
  private readonly retryPolicy: RetryPolicy
  private readonly riskClassifier: RiskClassifier
  private readonly stateStore?: WorkflowStateStore
  private readonly persistState: boolean

  constructor(private readonly options: TaskOrchestratorOptions) {
    this.checksRunner = options.checksRunner ?? new ExecutionRunner()
    this.modelRouter = options.modelRouter ?? new ModelRouter()
    this.promptStore = options.promptStore ?? new FilePromptStore()
    this.retryPolicy = options.retryPolicy ?? new RetryPolicy()
    this.riskClassifier = options.riskClassifier ?? new RiskClassifier()
    this.stateStore = options.stateStore
    this.persistState = options.persistState ?? true
  }

  async run(userRequest: string): Promise<WorkflowState> {
    const now = new Date().toISOString()
    const state: WorkflowState = {
      id: randomUUID(),
      request: userRequest,
      risk: this.riskClassifier.classify(userRequest),
      status: 'running',
      retries: 0,
      startedAt: now,
      updatedAt: now,
      phases: [],
    }

    await this.save(state)

    try {
      state.opusPlan = await this.opusPlan(state)
      state.gptReview = await this.gptReview(state)
      state.finalPlan = await this.opusFinalize(state)
      state.executionResult = await this.sonnetExecute(state)
      state.checkResult = await this.runChecks(state)

      while (true) {
        const decision = await this.decide(state)

        if (decision === 'FINAL_REVIEW') {
          break
        }

        if (decision === 'OPUS_REANALYZE') {
          state.status = 'needs_opus_reanalysis'
          await this.opusReanalyze(state)
          await this.save(state)
          return state
        }

        state.retries += 1
        state.executionResult = await this.sonnetFix(state)
        state.checkResult = await this.runChecks(state)
      }

      state.finalReview = await this.finalReview(state)
      state.status = state.finalReview.decision === 'BLOCK' ? 'failed' : 'completed'
      state.updatedAt = new Date().toISOString()
      await this.save(state)
      return state
    } catch (error) {
      state.status = 'failed'
      state.updatedAt = new Date().toISOString()
      await this.failPhase(state, error)
      await this.save(state)
      return state
    }
  }

  private async opusPlan(state: WorkflowState): Promise<PlanOutput> {
    return this.runClaudeJsonStage<PlanOutput>(state, 'OPUS_PLAN', PROMPT_NAMES.opusPlanner, {
      userRequest: state.request,
      risk: state.risk,
    })
  }

  private async gptReview(state: WorkflowState): Promise<GptReviewOutput> {
    return this.runGptJsonStage<GptReviewOutput>(state, 'GPT_REVIEW', PROMPT_NAMES.gptReviewer, {
      userRequest: state.request,
      opusPlan: state.opusPlan,
      risk: state.risk,
    })
  }

  private async opusFinalize(state: WorkflowState): Promise<PlanOutput> {
    return this.runClaudeJsonStage<PlanOutput>(state, 'OPUS_FINALIZE', PROMPT_NAMES.opusFinalizer, {
      userRequest: state.request,
      opusPlan: state.opusPlan,
      gptReview: state.gptReview,
      risk: state.risk,
    })
  }

  private async sonnetExecute(state: WorkflowState): Promise<ExecutionOutput> {
    return this.runClaudeJsonStage<ExecutionOutput>(state, 'SONNET_EXECUTE', PROMPT_NAMES.sonnetExecutor, {
      userRequest: state.request,
      finalPlan: state.finalPlan,
      risk: state.risk,
    })
  }

  private async sonnetFix(state: WorkflowState): Promise<ExecutionOutput> {
    return this.runClaudeJsonStage<ExecutionOutput>(state, 'SONNET_FIX', PROMPT_NAMES.sonnetFixer, {
      userRequest: state.request,
      finalPlan: state.finalPlan,
      previousExecution: state.executionResult,
      failedChecks: state.checkResult,
      retry: state.retries,
      maxRetries: this.retryPolicy.getMaxFixRetries(),
    })
  }

  private async runChecks(state: WorkflowState): Promise<RunChecksResult> {
    const commands =
      state.executionResult?.verificationCommands.length
        ? state.executionResult.verificationCommands
        : state.finalPlan?.verificationCommands.length
          ? state.finalPlan.verificationCommands
          : DEFAULT_VERIFICATION_COMMANDS

    await this.startPhase(state, 'RUN_CHECKS')
    const result = await this.checksRunner.runCommands(commands)
    state.testResult = result
    await this.completePhase(state, result)
    return result
  }

  private async decide(
    state: WorkflowState,
  ): Promise<'FINAL_REVIEW' | 'SONNET_FIX' | 'OPUS_REANALYZE'> {
    await this.startPhase(state, 'DECIDE')

    const decision = state.checkResult?.passed
      ? 'FINAL_REVIEW'
      : this.retryPolicy.canRetry(state.retries)
        ? 'SONNET_FIX'
        : 'OPUS_REANALYZE'

    await this.completePhase(state, {
      decision,
      retries: state.retries,
      maxRetries: this.retryPolicy.getMaxFixRetries(),
    })

    return decision
  }

  private async finalReview(state: WorkflowState): Promise<FinalReviewOutput> {
    const route = this.modelRouter.route('FINAL_REVIEW', state.risk)
    const variables = {
      userRequest: state.request,
      finalPlan: state.finalPlan,
      executionResult: state.executionResult,
      checkResult: state.checkResult,
      testResult: state.testResult,
      risk: state.risk,
    }

    if (route.provider === 'claude') {
      return this.runClaudeJsonStage<FinalReviewOutput>(state, 'FINAL_REVIEW', PROMPT_NAMES.finalReview, variables)
    }

    return this.runGptJsonStage<FinalReviewOutput>(state, 'FINAL_REVIEW', PROMPT_NAMES.finalReview, variables)
  }

  private async opusReanalyze(state: WorkflowState): Promise<PlanOutput> {
    return this.runClaudeJsonStage<PlanOutput>(state, 'OPUS_REANALYZE', PROMPT_NAMES.opusPlanner, {
      userRequest: state.request,
      finalPlan: state.finalPlan,
      failedChecks: state.checkResult,
      risk: state.risk,
    })
  }

  private async runClaudeJsonStage<T>(
    state: WorkflowState,
    phase: WorkflowPhase,
    promptName: string,
    variables: Record<string, unknown>,
  ): Promise<T> {
    await this.startPhase(state, phase)
    const template = await this.promptStore.getTemplate(promptName)
    const prompt = renderPrompt(template, variables)
    const route = this.modelRouter.route(phase, state.risk)
    const response = await this.options.claude.sendToClaudeCode(route.model, prompt, variables)
    const output = parseJsonObject<T>(response)
    await this.completePhase(state, output)
    return output
  }

  private async runGptJsonStage<T>(
    state: WorkflowState,
    phase: WorkflowPhase,
    promptName: string,
    variables: Record<string, unknown>,
  ): Promise<T> {
    await this.startPhase(state, phase)
    const template = await this.promptStore.getTemplate(promptName)
    const prompt = renderPrompt(template, variables)
    const route = this.modelRouter.route(phase, state.risk)
    const response = await this.options.gpt.send(route.model, prompt, variables)
    const output = parseJsonObject<T>(response)
    await this.completePhase(state, output)
    return output
  }

  private async startPhase(
    state: WorkflowState,
    phase: WorkflowPhase,
  ): Promise<void> {
    const now = new Date().toISOString()
    state.currentPhase = phase
    state.updatedAt = now
    state.phases.push({ phase, status: 'started', startedAt: now })
    await this.save(state)
  }

  private async completePhase(
    state: WorkflowState,
    output: unknown,
  ): Promise<void> {
    const phase = state.phases.at(-1)
    if (!phase) {
      throw new Error('Cannot complete a workflow phase before it starts')
    }

    phase.status = 'completed'
    phase.completedAt = new Date().toISOString()
    phase.output = output
    state.updatedAt = phase.completedAt
    await this.save(state)
  }

  private async failPhase(
    state: WorkflowState,
    error: unknown,
  ): Promise<void> {
    const phase = state.phases.at(-1)
    if (!phase) {
      return
    }

    phase.status = 'failed'
    phase.completedAt = new Date().toISOString()
    phase.error = error instanceof Error ? error.message : String(error)
  }

  private async save(state: WorkflowState): Promise<void> {
    if (!this.persistState) {
      return
    }

    if (!state.logDir && this.stateStore) {
      state.logDir = this.stateStore.getRunDir(state.id)
    }

    await this.stateStore?.save(state)
  }
}
