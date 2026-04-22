import { MetricsGrid } from '@/features/platform-metrics/get-platform-metrics/metrics-grid';

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Overview</h2>
        <p className="text-sm text-muted-foreground">
          Platform-wide snapshot across all tenants.
        </p>
      </div>
      <MetricsGrid />
    </div>
  );
}
