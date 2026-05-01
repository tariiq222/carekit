#!/usr/bin/env node

import { createTaskOrchestratorFromEnv } from './config.js'
import { toPrettyJson } from './json.js'

const request = process.argv.slice(2).join(' ').trim()

if (!request) {
  process.stderr.write('Usage: pnpm orchestrate "Describe the task"\n')
  process.exit(1)
}

const orchestrator = createTaskOrchestratorFromEnv()
const state = await orchestrator.run(request)

process.stdout.write(
  toPrettyJson({
    id: state.id,
    status: state.status,
    risk: state.risk,
    retries: state.retries,
    logDir: state.logDir,
    finalReview: state.finalReview,
  }) + '\n',
)

process.exit(state.status === 'completed' ? 0 : 1)
