import { spawn } from 'node:child_process'

import { DEFAULT_COMMAND_TIMEOUT_MS } from './constants.js'
import type { CommandResult } from './types.js'

export interface SubprocessOptions {
  command: string
  args: string[]
  input?: string
  cwd?: string
  timeoutMs?: number
}

export function runSubprocess({
  command,
  args,
  input,
  cwd = process.cwd(),
  timeoutMs = DEFAULT_COMMAND_TIMEOUT_MS,
}: SubprocessOptions): Promise<CommandResult> {
  const startedAt = Date.now()

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      shell: false,
    })

    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
    }, timeoutMs)

    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk))
    child.on('error', (error) => {
      clearTimeout(timer)
      resolve({
        command: `${command} ${args.join(' ')}`,
        exitCode: 1,
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: error.message,
        durationMs: Date.now() - startedAt,
      })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({
        command: `${command} ${args.join(' ')}`,
        exitCode: code ?? 1,
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
        durationMs: Date.now() - startedAt,
      })
    })

    child.stdin.end(input ?? '')
  })
}
