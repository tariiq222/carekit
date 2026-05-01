import { describe, expect, it } from 'vitest'

import { RiskClassifier } from './risk-classifier.js'

describe('RiskClassifier', () => {
  it('classifies owner-sensitive requests as high risk', () => {
    const classifier = new RiskClassifier()

    const risk = classifier.classify('Update payment permissions and database migrations')

    expect(risk.level).toBe('high')
    expect(risk.reasons).toContain('permissions')
    expect(risk.reasons).toContain('database')
    expect(risk.reasons).toContain('payments')
    expect(risk.reasons).toContain('migrations')
  })

  it('classifies small documentation requests as low risk', () => {
    const classifier = new RiskClassifier()

    const risk = classifier.classify('Add a README example for running the CLI')

    expect(risk.level).toBe('low')
    expect(risk.reasons).toEqual([])
  })
})
