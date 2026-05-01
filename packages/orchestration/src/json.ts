function findJsonPayload(text: string): string {
  const trimmed = text.trim()

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fenced?.[1]) {
    return fenced[1].trim()
  }

  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1)
  }

  throw new Error('Model response did not include a JSON object')
}

export function parseJsonObject<T>(text: string): T {
  const parsed: unknown = JSON.parse(findJsonPayload(text))

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Model response JSON must be an object')
  }

  return parsed as T
}

export function toPrettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}
