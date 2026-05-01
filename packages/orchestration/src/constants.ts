export const DEFAULT_MAX_FIX_RETRIES = 2
export const DEFAULT_COMMAND_TIMEOUT_MS = 10 * 60 * 1000
export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1'
export const DEFAULT_GPT_REVIEW_MODEL = 'gpt-5.4'
export const DEFAULT_GPT_PROXY_MODE = 'http'
export const DEFAULT_CODEX_BIN = 'codex'
export const DEFAULT_CLAUDE_OPUS_MODEL = 'opus'
export const DEFAULT_CLAUDE_SONNET_MODEL = 'sonnet'
export const DEFAULT_CLAUDE_PROXY_MODE = 'http'
export const DEFAULT_CLAUDE_CODE_BIN = 'claude'
export const DEFAULT_MODEL_PROXY_PORT = 5197
export const DEFAULT_MODEL_PROXY_BASE_URL = `http://localhost:${DEFAULT_MODEL_PROXY_PORT}`
export const DEFAULT_LOG_DIR = '.orchestration/runs'
export const DEFAULT_VERIFICATION_COMMANDS = ['pnpm run build', 'pnpm run test']

export const PROMPT_NAMES = {
  opusPlanner: 'opus-planner.prompt',
  gptReviewer: 'gpt-reviewer.prompt',
  opusFinalizer: 'opus-finalizer.prompt',
  sonnetExecutor: 'sonnet-executor.prompt',
  sonnetFixer: 'sonnet-fixer.prompt',
  finalReview: 'final-review.prompt',
} as const
