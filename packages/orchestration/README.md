# Deqah Orchestration Workflow

This package provides a small internal orchestration workflow that can run from the CLI. It is intentionally simple: no queue, no database, no UI.

## Flow

```text
User Request
-> OPUS_PLAN
-> GPT_REVIEW
-> OPUS_FINALIZE
-> SONNET_EXECUTE
-> RUN_CHECKS
-> DECIDE
-> FINAL_REVIEW
```

If checks fail, Sonnet gets at most two fix attempts. After that the workflow stops with `needs_opus_reanalysis`.

## Responsibilities

- `TaskOrchestrator`: owns phase transitions, state, retries, and logs.
- `ModelRouter`: maps phases to Opus, GPT, or Sonnet.
- `ClaudeCodeProxy`: talks to Claude Code through `cli` or `http` mode.
- `GPTClient`: talks to Codex CLI, the local HTTP proxy, or an OpenAI-compatible endpoint.
- `LocalModelProxyServer`: optional localhost proxy that routes GPT to `codex exec` and Claude to `claude --print`.
- `ExecutionRunner`: runs verification commands and captures stdout, stderr, exit code, and duration.
- `RiskClassifier`: marks sensitive work as high risk.

## CLI

From the repo root:

```bash
/oo Add a small internal README example
```

Inside a regular terminal, use:

```bash
pnpm o "Add a small internal README example"
```

Equivalent npm form:

```bash
npm run orchestrate -- "Add a small internal README example"
```

Long form:

```bash
pnpm orchestrate "Add a small internal README example"
```

Logs are written to `.orchestration/runs/<run-id>/state.json` by default.

## Local HTTP Proxy

Default mode uses the shared local HTTP proxy for both GPT and Claude. Start it once:

```bash
pnpm proxy
```

Then run orchestration:

```bash
pnpm o "Review the tenant settings page"
```

Both sides use local CLI login behind the proxy:

- `provider=gpt` -> `codex exec`
- `provider=claude` -> `claude --print`

## Environment

```bash
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=
GPT_REVIEW_MODEL=gpt-5.4
GPT_PROXY_MODE=http
GPT_PROXY_BASE_URL=http://localhost:5197
CODEX_BIN=codex

CLAUDE_PROXY_MODE=http
CLAUDE_PROXY_BASE_URL=http://localhost:5197
CLAUDE_CODE_BIN=claude

CLAUDE_OPUS_MODEL=opus
CLAUDE_SONNET_MODEL=sonnet

ORCHESTRATION_MODEL_PROXY_PORT=5197
ORCHESTRATION_MODEL_PROXY_BASE_URL=http://localhost:5197
ORCHESTRATION_MAX_FIX_RETRIES=2
ORCHESTRATION_LOG_DIR=.orchestration/runs
ORCHESTRATION_COMMAND_TIMEOUT_MS=600000
```

## Proxy Modes

Default `http` mode sends both clients to the local model proxy.

Claude `cli` mode is still available and runs:

```text
CLAUDE_CODE_BIN --model <model> --print
```

GPT `cli` mode runs:

```text
CODEX_BIN exec -m <model> --output-last-message <tmp-file> -
```

`http` mode for both clients sends:

```http
POST <ORCHESTRATION_MODEL_PROXY_BASE_URL>/run
```

Body:

```json
{
  "provider": "gpt",
  "model": "gpt-5.4",
  "prompt": "...",
  "context": {}
}
```

Use API mode only when you explicitly want platform API billing:

```bash
GPT_PROXY_MODE=api OPENAI_API_KEY=... pnpm o "..."
```

## Example Request

```bash
pnpm o "Add a safe validation utility in packages/shared and verify it with a focused test"
```
