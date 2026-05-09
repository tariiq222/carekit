'use client';
import { ErrorBanner } from '@/components/error-banner';

export default function RouteError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="pt-8">
      <ErrorBanner error={error} onRetry={reset} context="route:/billing" />
    </div>
  );
}
