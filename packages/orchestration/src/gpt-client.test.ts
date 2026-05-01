import { chmod, mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { describe, expect, it } from 'vitest'

import { GPTClient } from './gpt-client.js'

describe('GPTClient', () => {
  it('can review through a CLI without an API key', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'deqah-gpt-cli-'))
    const bin = join(dir, 'fake-gpt-cli.mjs')

    await writeFile(
      bin,
      [
        '#!/usr/bin/env node',
        "import { writeFileSync } from 'node:fs'",
        "const outputFlag = process.argv.indexOf('--output-last-message')",
        "const outputPath = process.argv[outputFlag + 1]",
        "writeFileSync(outputPath, JSON.stringify({ decision: 'APPROVE', missingItems: [], risks: [], recommendations: [] }))",
        "process.stdout.write('ok')",
      ].join('\n'),
      'utf8',
    )
    await chmod(bin, 0o755)

    const client = new GPTClient({
      mode: 'cli',
      cliBin: bin,
      cwd: process.cwd(),
      defaultModel: 'gpt-review',
    })

    const output = await client.send('gpt-review', 'review this')

    expect(JSON.parse(output)).toEqual({
      decision: 'APPROVE',
      missingItems: [],
      risks: [],
      recommendations: [],
    })
  })
})
