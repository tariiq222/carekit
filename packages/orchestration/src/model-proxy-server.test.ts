import { chmod, mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, describe, expect, it } from 'vitest'

import { LocalModelProxyServer } from './model-proxy-server.js'

describe('LocalModelProxyServer', () => {
  let server: LocalModelProxyServer | undefined

  afterEach(async () => {
    await server?.stop()
    server = undefined
  })

  it('routes GPT requests to Codex CLI and Claude requests to Claude CLI', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'deqah-model-proxy-'))
    const codexBin = join(dir, 'fake-codex.mjs')
    const claudeBin = join(dir, 'fake-claude.mjs')

    await writeFile(
      codexBin,
      [
        '#!/usr/bin/env node',
        "import { writeFileSync } from 'node:fs'",
        "const outputFlag = process.argv.indexOf('--output-last-message')",
        "writeFileSync(process.argv[outputFlag + 1], JSON.stringify({ source: 'codex' }))",
      ].join('\n'),
      'utf8',
    )
    await writeFile(
      claudeBin,
      [
        '#!/usr/bin/env node',
        "process.stdout.write(JSON.stringify({ source: 'claude' }))",
      ].join('\n'),
      'utf8',
    )
    await chmod(codexBin, 0o755)
    await chmod(claudeBin, 0o755)

    server = new LocalModelProxyServer({
      codexBin,
      claudeBin,
      cwd: process.cwd(),
    })
    const { baseURL } = await server.start(0)

    const gptResponse = await fetch(`${baseURL}/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: 'gpt',
        model: 'gpt-review',
        prompt: 'review',
      }),
    })
    const claudeResponse = await fetch(`${baseURL}/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: 'claude',
        model: 'opus',
        prompt: 'plan',
      }),
    })

    await expect(gptResponse.json()).resolves.toEqual({
      output: JSON.stringify({ source: 'codex' }),
    })
    await expect(claudeResponse.json()).resolves.toEqual({
      output: JSON.stringify({ source: 'claude' }),
    })
  })
})
