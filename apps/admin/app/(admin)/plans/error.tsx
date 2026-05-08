'use client';
import { ErrorBanner } from '@/components/error-banner';

export default function RouteError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-6">
      <ErrorBanner error={error} onRetry={reset} context="route:/plans" />
    </div>
  );
}
