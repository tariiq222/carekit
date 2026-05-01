#!/usr/bin/env node

import {
  DEFAULT_CLAUDE_CODE_BIN,
  DEFAULT_CODEX_BIN,
  DEFAULT_COMMAND_TIMEOUT_MS,
  DEFAULT_MODEL_PROXY_PORT,
} from './constants.js'
import { LocalModelProxyServer } from './model-proxy-server.js'

function readNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const server = new LocalModelProxyServer({
  codexBin: process.env.CODEX_BIN ?? DEFAULT_CODEX_BIN,
  claudeBin: process.env.CLAUDE_CODE_BIN ?? DEFAULT_CLAUDE_CODE_BIN,
  cwd: process.cwd(),
  timeoutMs: readNumber(
    process.env.ORCHESTRATION_COMMAND_TIMEOUT_MS,
    DEFAULT_COMMAND_TIMEOUT_MS,
  ),
})

const started = await server.start(
  readNumber(process.env.ORCHESTRATION_MODEL_PROXY_PORT, DEFAULT_MODEL_PROXY_PORT),
)

process.stdout.write(`Deqah model proxy listening on ${started.baseURL}\n`)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.stop().finally(() => process.exit(0))
  })
}
