import { randomUUID } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import {
  DEFAULT_CLAUDE_CODE_BIN,
  DEFAULT_CODEX_BIN,
  DEFAULT_COMMAND_TIMEOUT_MS,
  DEFAULT_MODEL_PROXY_PORT,
} from './constants.js'
import { runSubprocess } from './subprocess.js'
import type { ModelContext } from './types.js'

type ModelProvider = 'gpt' | 'claude'

interface ProxyRequest {
  provider?: ModelProvider
  model?: string
  prompt?: string
  context?: ModelContext
}

export interface LocalModelProxyConfig {
  codexBin?: string
  claudeBin?: string
  cwd?: string
  timeoutMs?: number
}

export interface StartedProxy {
  port: number
  baseURL: string
}

export class LocalModelProxyServer {
  private server?: Server
  private readonly codexBin: string
  private readonly claudeBin: string
  private readonly cwd: string
  private readonly timeoutMs: number

  constructor(config: LocalModelProxyConfig = {}) {
    this.codexBin = config.codexBin ?? DEFAULT_CODEX_BIN
    this.claudeBin = config.claudeBin ?? DEFAULT_CLAUDE_CODE_BIN
    this.cwd = config.cwd ?? process.cwd()
    this.timeoutMs = config.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS
  }

  start(port = DEFAULT_MODEL_PROXY_PORT): Promise<StartedProxy> {
    this.server = createServer((request, response) => {
      this.handle(request, response).catch((error: unknown) => {
        this.sendJson(response, 500, {
          error: error instanceof Error ? error.message : String(error),
        })
      })
    })

    return new Promise((resolve) => {
      this.server?.listen(port, '127.0.0.1', () => {
        const address = this.server?.address()
        const actualPort =
          typeof address === 'object' && address ? address.port : port

        resolve({
          port: actualPort,
          baseURL: `http://127.0.0.1:${actualPort}`,
        })
      })
    })
  }

  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve()
        return
      }

      this.server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        this.server = undefined
        resolve()
      })
    })
  }

  private async handle(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    if (request.method !== 'POST' || request.url !== '/run') {
      this.sendJson(response, 404, { error: 'Use POST /run' })
      return
    }

    const payload = await this.readRequest(request)

    if (!payload.provider || !payload.prompt) {
      this.sendJson(response, 400, {
        error: 'Request must include provider and prompt',
      })
      return
    }

    const output =
      payload.provider === 'gpt'
        ? await this.runCodex(payload)
        : await this.runClaude(payload)

    this.sendJson(response, 200, { output })
  }

  private async runCodex(payload: ProxyRequest): Promise<string> {
    const outputPath = join(tmpdir(), `deqah-codex-${randomUUID()}.json`)
    const result = await runSubprocess({
      command: this.codexBin,
      args: [
        'exec',
        '-m',
        payload.model ?? 'gpt-5.4',
        '-C',
        this.cwd,
        '--sandbox',
        'read-only',
        '--output-last-message',
        outputPath,
        '-',
      ],
      input: this.renderInput(payload),
      cwd: this.cwd,
      timeoutMs: this.timeoutMs,
    })

    if (result.exitCode !== 0) {
      throw new Error(`Codex CLI failed: ${result.stderr}`)
    }

    try {
      return await readFile(outputPath, 'utf8')
    } catch {
      return result.stdout
    } finally {
      await rm(outputPath, { force: true })
    }
  }

  private async runClaude(payload: ProxyRequest): Promise<string> {
    const result = await runSubprocess({
      command: this.claudeBin,
      args: ['--model', payload.model ?? 'opus', '--print'],
      input: this.renderInput(payload),
      cwd: this.cwd,
      timeoutMs: this.timeoutMs,
    })

    if (result.exitCode !== 0) {
      throw new Error(`Claude CLI failed: ${result.stderr}`)
    }

    return result.stdout
  }

  private renderInput(payload: ProxyRequest): string {
    return `${payload.prompt ?? ''}\n\nContext:\n${JSON.stringify(payload.context ?? {}, null, 2)}`
  }

  private async readRequest(request: IncomingMessage): Promise<ProxyRequest> {
    const chunks: Buffer[] = []

    for await (const chunk of request) {
      chunks.push(Buffer.from(chunk))
    }

    const body = Buffer.concat(chunks).toString('utf8')
    return JSON.parse(body) as ProxyRequest
  }

  private sendJson(
    response: ServerResponse,
    statusCode: number,
    body: unknown,
  ): void {
    response.writeHead(statusCode, { 'content-type': 'application/json' })
    response.end(JSON.stringify(body))
  }
}
