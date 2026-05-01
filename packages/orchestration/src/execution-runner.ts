import { spawn } from 'node:child_process'

import { DEFAULT_COMMAND_TIMEOUT_MS } from './constants.js'
import type { CommandResult, RunChecksResult } from './types.js'

export class ExecutionRunner {
  constructor(
    private readonly cwd = process.cwd(),
    private readonly timeoutMs = DEFAULT_COMMAND_TIMEOUT_MS,
  ) {}

  async runCommands(commands: string[]): Promise<RunChecksResult> {
    const results: CommandResult[] = []

    for (const command of commands) {
      const result = await this.runCommand(command)
      results.push(result)

      if (result.exitCode !== 0) {
        break
      }
    }

    return {
      passed: results.every((result) => result.exitCode === 0),
      results,
    }
  }

  private runCommand(command: string): Promise<CommandResult> {
    const startedAt = Date.now()

    return new Promise((resolve) => {
      const child = spawn(command, {
        cwd: this.cwd,
        env: process.env,
        shell: true,
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
          command,
          exitCode: 1,
          stdout: Buffer.concat(stdoutChunks).toString('utf8'),
          stderr: error.message,
          durationMs: Date.now() - startedAt,
        })
      })
      child.on('close', (code) => {
        clearTimeout(timer)
        resolve({
          command,
          exitCode: code ?? 1,
          stdout: Buffer.concat(stdoutChunks).toString('utf8'),
          stderr: Buffer.concat(stderrChunks).toString('utf8'),
          durationMs: Date.now() - startedAt,
        })
      })
    })
  }
}
