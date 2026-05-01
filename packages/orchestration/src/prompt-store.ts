import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { toPrettyJson } from './json.js'

const currentDir = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(currentDir, '..')

export class FilePromptStore {
  constructor(private readonly promptsDir = resolve(packageRoot, 'prompts')) {}

  async getTemplate(name: string): Promise<string> {
    return readFile(resolve(this.promptsDir, name), 'utf8')
  }
}

export function renderPrompt(
  template: string,
  variables: Record<string, unknown>,
): string {
  return Object.entries(variables).reduce((content, [key, value]) => {
    const rendered =
      typeof value === 'string' ? value : toPrettyJson(value)

    return content.replaceAll(`{{${key}}}`, rendered)
  }, template)
}
