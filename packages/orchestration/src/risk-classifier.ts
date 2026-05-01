import type { RiskAssessment, RiskLevel } from './types.js'

const HIGH_RISK_PATTERNS: ReadonlyArray<[string, RegExp]> = [
  ['auth', /\bauth(?:entication|orization)?\b|identity|login|jwt/i],
  ['permissions', /permission|role|rbac|casl|owner-only/i],
  ['database', /database|postgres|prisma|schema|rls|sql\b/i],
  ['payments', /payment|payments|moyasar|invoice|billing/i],
  ['security', /security|secret|token|credential|encryption/i],
  ['orchestration', /orchestration|orchestrator|agent workflow/i],
  ['migrations', /migration|migrate/i],
  ['large refactor', /large refactor|major refactor|rewrite/i],
]

const MEDIUM_RISK_PATTERN =
  /integration|multi-file|several files|api contract|build pipeline|docker/i

export class RiskClassifier {
  classify(userRequest: string): RiskAssessment {
    const reasons = HIGH_RISK_PATTERNS.filter(([, pattern]) =>
      pattern.test(userRequest),
    ).map(([reason]) => reason)

    const level: RiskLevel =
      reasons.length > 0
        ? 'high'
        : MEDIUM_RISK_PATTERN.test(userRequest)
          ? 'medium'
          : 'low'

    return { level, reasons }
  }
}
