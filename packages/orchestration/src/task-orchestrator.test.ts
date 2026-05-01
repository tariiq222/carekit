import { describe, expect, it } from 'vitest'

import { ModelRouter } from './model-router.js'
import { RetryPolicy } from './retry-policy.js'
import { RiskClassifier } from './risk-classifier.js'
import { TaskOrchestrator } from './task-orchestrator.js'
import type {
  ClaudeCodeClient,
  CommandResult,
  GptModelClient,
  PromptStore,
  RunChecksResult,
} from './types.js'

class StaticPrompts implements PromptStore {
  getTemplate(name: string): Promise<string> {
    return Promise.resolve(`template:${name}`)
  }
}

class FakeClaude implements ClaudeCodeClient {
  calls: string[] = []

  async sendToClaudeCode(model: string, prompt: string): Promise<string> {
    this.calls.push(`${model}:${prompt}`)

    if (prompt.includes('sonnet-fixer')) {
      return JSON.stringify({
        changedFiles: ['packages/orchestration/src/task-orchestrator.ts'],
        summary: 'fixed checks',
        verificationCommands: ['pnpm --filter=@deqah/orchestration test'],
        assumptions: [],
      })
    }

    if (prompt.includes('sonnet-executor')) {
      return JSON.stringify({
        changedFiles: ['packages/orchestration/src/task-orchestrator.ts'],
        summary: 'executed plan',
        verificationCommands: ['pnpm --filter=@deqah/orchestration test'],
        assumptions: [],
      })
    }

    return JSON.stringify({
      scope: 'orchestration package',
      targetFiles: ['packages/orchestration/src/task-orchestrator.ts'],
      executionPlan: ['implement orchestrator'],
      risks: [],
      verificationCommands: ['pnpm --filter=@deqah/orchestration test'],
      outOfScope: [],
    })
  }
}

class FakeGpt implements GptModelClient {
  calls: string[] = []

  async send(model: string, prompt: string): Promise<string> {
    this.calls.push(`${model}:${prompt}`)

    return JSON.stringify({
      decision: 'APPROVE',
      missingItems: [],
      risks: [],
      recommendations: [],
    })
  }
}

class FlakyChecks {
  private attempts = 0

  async runCommands(commands: string[]): Promise<RunChecksResult> {
    this.attempts += 1
    const failed = this.attempts === 1
    const result: CommandResult = {
      command: commands[0] ?? 'pnpm test',
      exitCode: failed ? 1 : 0,
      stdout: failed ? '' : 'ok',
      stderr: failed ? 'failed' : '',
      durationMs: 1,
    }

    return {
      passed: !failed,
      results: [result],
    }
  }
}

describe('TaskOrchestrator', () => {
  it('routes failed checks to Sonnet fix once before final review', async () => {
    const claude = new FakeClaude()
    const gpt = new FakeGpt()
    const orchestrator = new TaskOrchestrator({
      claude,
      gpt,
      checksRunner: new FlakyChecks(),
      modelRouter: new ModelRouter({
        gptReviewModel: 'gpt-review',
        claudeOpusModel: 'opus',
        claudeSonnetModel: 'sonnet',
      }),
      promptStore: new StaticPrompts(),
      retryPolicy: new RetryPolicy(2),
      riskClassifier: new RiskClassifier(),
      persistState: false,
    })

    const state = await orchestrator.run('Add an orchestration README')

    expect(state.status).toBe('completed')
    expect(state.retries).toBe(1)
    expect(claude.calls.some((call) => call.includes('sonnet-fixer'))).toBe(true)
    expect(gpt.calls.at(-1)).toContain('gpt-review')
    expect(state.checkResult?.passed).toBe(true)
  })
})
