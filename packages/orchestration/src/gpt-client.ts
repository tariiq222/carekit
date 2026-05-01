import { randomUUID } from 'node:crypto'
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import {
  DEFAULT_CODEX_BIN,
  DEFAULT_GPT_PROXY_MODE,
  DEFAULT_GPT_REVIEW_MODEL,
  DEFAULT_MODEL_PROXY_BASE_URL,
  DEFAULT_OPENAI_BASE_URL,
} from './constants.js'
import { runSubprocess } from './subprocess.js'
import type { GptModelClient, ModelContext } from './types.js'

interface ChatCompletionMessage {
  role: 'system' | 'user'
  content: string
}

interface ChatCompletionChoice {
  message?: {
    content?: string
  }
}

interface ChatCompletionResponse {
  choices?: ChatCompletionChoice[]
}

export interface GPTClientConfig {
  mode?: 'api' | 'cli' | 'http'
  baseURL?: string
  proxyBaseURL?: string
  apiKey?: string
  cliBin?: string
  cwd?: string
  timeoutMs?: number
  defaultModel?: string
}

export class GPTClient implements GptModelClient {
  private readonly mode: 'api' | 'cli' | 'http'
  private readonly baseURL: string
  private readonly proxyBaseURL?: string
  private readonly apiKey?: string
  private readonly cliBin: string
  private readonly cwd: string
  private readonly timeoutMs?: number
  private readonly defaultModel: string

  constructor(config: GPTClientConfig = {}) {
    this.mode =
      config.mode ?? (config.apiKey ? 'api' : (DEFAULT_GPT_PROXY_MODE as 'http'))
    this.baseURL = config.baseURL ?? DEFAULT_OPENAI_BASE_URL
    this.proxyBaseURL = config.proxyBaseURL ?? DEFAULT_MODEL_PROXY_BASE_URL
    this.apiKey = config.apiKey
    this.cliBin = config.cliBin ?? DEFAULT_CODEX_BIN
    this.cwd = config.cwd ?? process.cwd()
    this.timeoutMs = config.timeoutMs
    this.defaultModel = config.defaultModel ?? DEFAULT_GPT_REVIEW_MODEL
  }

  async send(
    model: string,
    prompt: string,
    context: ModelContext = {},
  ): Promise<string> {
    if (this.mode === 'http') {
      return this.sendHttp(model, prompt, context)
    }

    if (this.mode === 'cli') {
      return this.sendCli(model, prompt, context)
    }

    return this.sendApi(model, prompt, context)
  }

  private async sendCli(
    model: string,
    prompt: string,
    context: ModelContext,
  ): Promise<string> {
    const outputPath = join(tmpdir(), `deqah-gpt-${randomUUID()}.json`)
    const input = `${prompt}\n\nContext:\n${JSON.stringify(context, null, 2)}`
    const result = await runSubprocess({
      command: this.cliBin,
      args: [
        'exec',
        '-m',
        model || this.defaultModel,
        '-C',
        this.cwd,
        '--sandbox',
        'read-only',
        '--output-last-message',
        outputPath,
        '-',
      ],
      input,
      cwd: this.cwd,
      timeoutMs: this.timeoutMs,
    })

    if (result.exitCode !== 0) {
      throw new Error(`Codex CLI review failed: ${result.stderr}`)
    }

    try {
      return await readFile(outputPath, 'utf8')
    } catch {
      return result.stdout
    } finally {
      await rm(outputPath, { force: true })
    }
  }

  private async sendHttp(
    model: string,
    prompt: string,
    context: ModelContext,
  ): Promise<string> {
    if (!this.proxyBaseURL) {
      throw new Error('GPT_PROXY_BASE_URL is required in http mode')
    }

    const response = await fetch(`${this.proxyBaseURL.replace(/\/$/, '')}/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: 'gpt',
        model,
        prompt,
        context,
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`GPT proxy failed with ${response.status}: ${body}`)
    }

    const payload = (await response.json()) as { output?: string }

    if (!payload.output) {
      throw new Error('GPT proxy response must include output')
    }

    return payload.output
  }

  private async sendApi(
    model: string,
    prompt: string,
    context: ModelContext,
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is required for GPT review stages')
    }

    const messages: ChatCompletionMessage[] = [
      {
        role: 'system',
        content:
          'You are a strict reviewer. Return one valid JSON object only.',
      },
      {
        role: 'user',
        content: `${prompt}\n\nContext:\n${JSON.stringify(context, null, 2)}`,
      },
    ]

    const response = await fetch(`${this.baseURL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: model || this.defaultModel,
        messages,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`GPT request failed with ${response.status}: ${body}`)
    }

    const payload = (await response.json()) as ChatCompletionResponse
    const content = payload.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('GPT response did not include message content')
    }

    return content
  }
}
