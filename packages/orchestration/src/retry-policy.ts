import { DEFAULT_MAX_FIX_RETRIES } from './constants.js'

export class RetryPolicy {
  constructor(private readonly maxFixRetries = DEFAULT_MAX_FIX_RETRIES) {}

  canRetry(currentRetries: number): boolean {
    return currentRetries < this.maxFixRetries
  }

  getMaxFixRetries(): number {
    return this.maxFixRetries
  }
}
