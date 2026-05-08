import { describe, it, expect, vi } from 'vitest';
import * as Sentry from '@sentry/nextjs';
import { withSentryMutation } from '@/lib/sentry-mutation';

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

describe('withSentryMutation', () => {
  it('captures the exception with the provided context tag', () => {
    const opts = withSentryMutation({ context: 'admin:refund-invoice', mutationFn: async () => undefined });
    const err = new Error('boom');
    opts.onError?.(err as never, undefined as never, undefined as never, undefined as never);
    expect(Sentry.captureException).toHaveBeenCalledWith(err, { tags: { mutation: 'admin:refund-invoice' } });
  });

  it('still calls the user-provided onError', () => {
    const userOnError = vi.fn();
    const opts = withSentryMutation({
      context: 'admin:foo',
      mutationFn: async () => undefined,
      onError: userOnError,
    });
    opts.onError?.(new Error('e') as never, undefined as never, undefined as never, undefined as never);
    expect(userOnError).toHaveBeenCalled();
  });

  it('wraps non-Error rejection values into Error before capturing', () => {
    const opts = withSentryMutation({ context: 'admin:foo', mutationFn: async () => undefined });
    opts.onError?.('string error' as never, undefined as never, undefined as never, undefined as never);
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      { tags: { mutation: 'admin:foo' } },
    );
  });
});
