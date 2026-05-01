import {
  DEFAULT_CLAUDE_CODE_BIN,
  DEFAULT_CLAUDE_OPUS_MODEL,
  DEFAULT_CLAUDE_PROXY_MODE,
  DEFAULT_CLAUDE_SONNET_MODEL,
  DEFAULT_CODEX_BIN,
  DEFAULT_COMMAND_TIMEOUT_MS,
  DEFAULT_GPT_REVIEW_MODEL,
  DEFAULT_GPT_PROXY_MODE,
  DEFAULT_LOG_DIR,
  DEFAULT_MAX_FIX_RETRIES,
  DEFAULT_MODEL_PROXY_BASE_URL,
  DEFAULT_OPENAI_BASE_URL,
} from './constants.js'
import { ClaudeCodeProxy } from './claude-code-proxy.js'
import { ExecutionRunner } from './execution-runner.js'
import { GPTClient } from './gpt-client.js'
import { ModelRouter } from './model-router.js'
import { RetryPolicy } from './retry-policy.js'
import { RiskClassifier } from './risk-classifier.js'
import { WorkflowStateStore } from './state-store.js'
import { TaskOrchestrator } from './task-orchestrator.js'

function readNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function readClaudeProxyMode(value: string | undefined): 'cli' | 'http' {
  if (value === 'http' || value === 'cli') {
    return value
  }

  return DEFAULT_CLAUDE_PROXY_MODE as 'http'
}

function readGptProxyMode(value: string | undefined): 'api' | 'cli' | 'http' {
  if (value === 'api' || value === 'cli' || value === 'http') {
    return value
  }

  return DEFAULT_GPT_PROXY_MODE as 'http'
}

export function createTaskOrchestratorFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): TaskOrchestrator {
  const timeoutMs = readNumber(
    env.ORCHESTRATION_COMMAND_TIMEOUT_MS,
    DEFAULT_COMMAND_TIMEOUT_MS,
  )
  const sharedProxyBaseURL =
    env.ORCHESTRATION_MODEL_PROXY_BASE_URL ?? DEFAULT_MODEL_PROXY_BASE_URL

  return new TaskOrchestrator({
    claude: new ClaudeCodeProxy({
      mode: readClaudeProxyMode(env.CLAUDE_PROXY_MODE),
      baseURL: env.CLAUDE_PROXY_BASE_URL ?? sharedProxyBaseURL,
      bin: env.CLAUDE_CODE_BIN ?? DEFAULT_CLAUDE_CODE_BIN,
      cwd,
      timeoutMs,
    }),
    gpt: new GPTClient({
      mode: readGptProxyMode(env.GPT_PROXY_MODE),
      baseURL: env.OPENAI_BASE_URL ?? DEFAULT_OPENAI_BASE_URL,
      proxyBaseURL: env.GPT_PROXY_BASE_URL ?? sharedProxyBaseURL,
      apiKey: env.OPENAI_API_KEY,
      cliBin: env.CODEX_BIN ?? DEFAULT_CODEX_BIN,
      cwd,
      timeoutMs,
      defaultModel: env.GPT_REVIEW_MODEL ?? DEFAULT_GPT_REVIEW_MODEL,
    }),
    checksRunner: new ExecutionRunner(cwd, timeoutMs),
    modelRouter: new ModelRouter({
      claudeOpusModel: env.CLAUDE_OPUS_MODEL ?? DEFAULT_CLAUDE_OPUS_MODEL,
      claudeSonnetModel:
        env.CLAUDE_SONNET_MODEL ?? DEFAULT_CLAUDE_SONNET_MODEL,
      gptReviewModel: env.GPT_REVIEW_MODEL ?? DEFAULT_GPT_REVIEW_MODEL,
    }),
    retryPolicy: new RetryPolicy(
      readNumber(
        env.ORCHESTRATION_MAX_FIX_RETRIES,
        DEFAULT_MAX_FIX_RETRIES,
      ),
    ),
    riskClassifier: new RiskClassifier(),
    stateStore: new WorkflowStateStore(env.ORCHESTRATION_LOG_DIR ?? DEFAULT_LOG_DIR, cwd),
  })
}
