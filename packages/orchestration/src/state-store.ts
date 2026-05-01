import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { DEFAULT_LOG_DIR } from './constants.js'
import { toPrettyJson } from './json.js'
import type { WorkflowState } from './types.js'

export class WorkflowStateStore {
  private readonly rootDir: string

  constructor(rootDir = DEFAULT_LOG_DIR, private readonly cwd = process.cwd()) {
    this.rootDir = resolve(cwd, rootDir)
  }

  getRunDir(runId: string): string {
    return resolve(this.rootDir, runId)
  }

  async save(state: WorkflowState): Promise<void> {
    const runDir = this.getRunDir(state.id)
    await mkdir(runDir, { recursive: true })
    await writeFile(resolve(runDir, 'state.json'), toPrettyJson(state), 'utf8')

    const latestPhase = state.phases.at(-1)
    if (latestPhase) {
      await writeFile(
        resolve(runDir, `${String(state.phases.length).padStart(2, '0')}-${latestPhase.phase}.json`),
        toPrettyJson(latestPhase),
        'utf8',
      )
    }
  }
}
