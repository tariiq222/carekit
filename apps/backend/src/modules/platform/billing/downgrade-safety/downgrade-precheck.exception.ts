import { HttpException, HttpStatus } from '@nestjs/common';
import { DowngradeViolation } from './downgrade-safety.service';

/**
 * Thrown when an attempted downgrade would put the organization above the
 * target plan's hard caps. HTTP 422 (Unprocessable Entity) — the request is
 * structurally valid but cannot be applied in the current state.
 *
 * The body shape is bilingual and machine-readable so the dashboard can
 * surface a per-dimension hint ("you have 12 employees but BASIC allows 5").
 */
export interface DowngradePrecheckExceptionBody {
  code: 'DOWNGRADE_VIOLATES_NEW_LIMITS';
  message: string;
  messageAr: string;
  violations: DowngradeViolation[];
}

export class DowngradePrecheckFailedException extends HttpException {
  constructor(violations: DowngradeViolation[]) {
    const body: DowngradePrecheckExceptionBody = {
      code: 'DOWNGRADE_VIOLATES_NEW_LIMITS',
      message:
        'Cannot downgrade: your current usage exceeds the target plan limits. Reduce usage or pick a higher plan.',
      messageAr:
        'لا يمكن تخفيض الباقة: استخدامك الحالي يتجاوز حدود الباقة المستهدفة. قلّل الاستخدام أو اختر باقة أعلى.',
      violations,
    };
    super(body, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}
