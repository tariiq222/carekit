import {
  DEFAULT_CLAUDE_OPUS_MODEL,
  DEFAULT_CLAUDE_SONNET_MODEL,
  DEFAULT_GPT_REVIEW_MODEL,
} from './constants.js'
import type { RiskAssessment, WorkflowPhase } from './types.js'

export interface ModelRouterConfig {
  claudeOpusModel?: string
  claudeSonnetModel?: string
  gptReviewModel?: string
}

export interface RoutedModel {
  provider: 'claude' | 'gpt'
  model: string
}

export class ModelRouter {
  private readonly claudeOpusModel: string
  private readonly claudeSonnetModel: string
  private readonly gptReviewModel: string

  constructor(config: ModelRouterConfig = {}) {
    this.claudeOpusModel = config.claudeOpusModel ?? DEFAULT_CLAUDE_OPUS_MODEL
    this.claudeSonnetModel =
      config.claudeSonnetModel ?? DEFAULT_CLAUDE_SONNET_MODEL
    this.gptReviewModel = config.gptReviewModel ?? DEFAULT_GPT_REVIEW_MODEL
  }

  route(phase: WorkflowPhase, risk?: RiskAssessment): RoutedModel {
    if (phase === 'GPT_REVIEW') {
      return { provider: 'gpt', model: this.gptReviewModel }
    }

    if (phase === 'FINAL_REVIEW') {
      return risk?.level === 'high'
        ? { provider: 'claude', model: this.claudeOpusModel }
        : { provider: 'gpt', model: this.gptReviewModel }
    }

    if (phase === 'SONNET_EXECUTE' || phase === 'SONNET_FIX') {
      return { provider: 'claude', model: this.claudeSonnetModel }
    }

    return { provider: 'claude', model: this.claudeOpusModel }
  }
}
