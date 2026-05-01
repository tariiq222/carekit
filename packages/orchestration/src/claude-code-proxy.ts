import { spawn } from 'node:child_process'

import {
  DEFAULT_CLAUDE_CODE_BIN,
  DEFAULT_CLAUDE_PROXY_MODE,
  DEFAULT_COMMAND_TIMEOUT_MS,
  DEFAULT_MODEL_PROXY_BASE_URL,
} from './constants.js'
import type { ClaudeCodeClient, CommandResult, ModelContext } from './types.js'

type ClaudeProxyMode = 'cli' | 'http'

export interface ClaudeCodeProxyConfig {
  mode?: ClaudeProxyMode
  baseURL?: string
  bin?: string
  cwd?: string
  timeoutMs?: number
}

export class ClaudeCodeProxy implements ClaudeCodeClient {
  private readonly mode: ClaudeProxyMode
  private readonly baseURL?: string
  private readonly bin: string
  private readonly cwd: string
  private readonly timeoutMs: number

  constructor(config: ClaudeCodeProxyConfig = {}) {
    this.mode = config.mode ?? (DEFAULT_CLAUDE_PROXY_MODE as ClaudeProxyMode)
    this.baseURL = config.baseURL ?? DEFAULT_MODEL_PROXY_BASE_URL
    this.bin = config.bin ?? DEFAULT_CLAUDE_CODE_BIN
    this.cwd = config.cwd ?? process.cwd()
    this.timeoutMs = config.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS
  }

  async sendToClaudeCode(
    model: string,
    prompt: string,
    context: ModelContext = {},
  ): Promise<string> {
    if (this.mode === 'http') {
      return this.sendHttp(model, prompt, context)
    }

    const commandInput = `${prompt}\n\nContext:\n${JSON.stringify(context, null, 2)}`
    const result = await this.runClaudeCommand(['--model', model, '--print'], commandInput)

    if (result.exitCode !== 0) {
      throw new Error(`Claude Code CLI failed: ${result.stderr}`)
    }

    return result.stdout
  }

  runClaudeCommand(args: string[], input: string): Promise<CommandResult> {
    const startedAt = Date.now()

    return new Promise((resolve) => {
      const child = spawn(this.bin, args, {
        cwd: this.cwd,
        env: process.env,
        shell: false,
      })

      const stdoutChunks: Buffer[] = []
      const stderrChunks: Buffer[] = []
      const timer = setTimeout(() => {
        child.kill('SIGTERM')
      }, this.timeoutMs)

      child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk))
      child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk))
      child.on('error', (error) => {
        clearTimeout(timer)
        resolve({
          command: `${this.bin} ${args.join(' ')}`,
          exitCode: 1,
          stdout: Buffer.concat(stdoutChunks).toString('utf8'),
          stderr: error.message,
          durationMs: Date.now() - startedAt,
        })
      })
      child.on('close', (code) => {
        clearTimeout(timer)
        resolve({
          command: `${this.bin} ${args.join(' ')}`,
          exitCode: code ?? 1,
          stdout: Buffer.concat(stdoutChunks).toString('utf8'),
          stderr: Buffer.concat(stderrChunks).toString('utf8'),
          durationMs: Date.now() - startedAt,
        })
      })

      child.stdin.end(input)
    })
  }

  private async sendHttp(
    model: string,
    prompt: string,
    context: ModelContext,
  ): Promise<string> {
    if (!this.baseURL) {
      throw new Error('CLAUDE_PROXY_BASE_URL is required in http mode')
    }

    const response = await fetch(`${this.baseURL.replace(/\/$/, '')}/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'claude', model, prompt, context }),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Claude proxy failed with ${response.status}: ${body}`)
    }

    const payload = (await response.json()) as { output?: string }

    if (!payload.output) {
      throw new Error('Claude proxy response must include output')
    }

    return payload.output
  }
}
