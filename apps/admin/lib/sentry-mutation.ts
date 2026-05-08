import * as Sentry from '@sentry/nextjs';
import type { UseMutationOptions } from '@tanstack/react-query';

/**
 * Wraps useMutation options to capture errors in Sentry/GlitchTip with a
 * context tag, while preserving the user-supplied onError handler (e.g.
 * toast.error). Use on every admin mutation hook so failed refunds, settings
 * writes, etc. produce a proper observability event instead of vanishing
 * behind a transient toast.
 */
export function withSentryMutation<
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown,
>(
  options: UseMutationOptions<TData, TError, TVariables, TContext> & { context: string },
): UseMutationOptions<TData, TError, TVariables, TContext> {
  const { context, onError: userOnError, ...rest } = options;
  return {
    ...rest,
    onError: (error, variables, onMutateResult, ctx) => {
      const errObj = error instanceof Error ? error : new Error(String(error));
      Sentry.captureException(errObj, { tags: { mutation: context } });
      userOnError?.(error, variables, onMutateResult, ctx);
    },
  };
}
