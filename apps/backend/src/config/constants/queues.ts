/**
 * BullMQ queue name constants — single source of truth.
 * Used in @InjectQueue(), @Processor(), and BullModule.registerQueue().
 */

export const QUEUE_EMAIL = 'email';
export const QUEUE_RECEIPT_VERIFICATION = 'receipt-verification';
export const QUEUE_TASKS = 'tasks';
export const QUEUE_ZATCA_SUBMIT = 'zatca-submit';

// ──────────────────────────────────────────────
// DLQ / Retry defaults — applied to every queue
// ──────────────────────────────────────────────

/** Max retry attempts per job before it's considered dead. */
export const JOB_ATTEMPTS = 3;

/** Base delay (ms) for exponential backoff between retries. */
export const JOB_BACKOFF_DELAY = 30_000; // 30 s

/** Keep at most N failed jobs per queue (oldest evicted first). */
export const JOB_REMOVE_ON_FAIL_COUNT = 50;

/** Auto-remove failed jobs older than this (seconds). */
export const JOB_REMOVE_ON_FAIL_AGE = 7 * 24 * 3600; // 7 days

/** Shared default job options — imported by every BullModule.registerQueue(). */
export const DEFAULT_JOB_OPTIONS = {
  attempts: JOB_ATTEMPTS,
  backoff: { type: 'exponential' as const, delay: JOB_BACKOFF_DELAY },
  removeOnFail: {
    count: JOB_REMOVE_ON_FAIL_COUNT,
    age: JOB_REMOVE_ON_FAIL_AGE,
  },
} as const;
