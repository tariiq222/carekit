import { BillingMetricsGrid } from '@/features/billing/get-billing-metrics/billing-metrics-grid';

export default function BillingMetricsPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Metrics</h2>
        <p className="text-sm text-muted-foreground">
          MRR, ARR, churn, and per-plan revenue across all tenants.
        </p>
      </div>
      <BillingMetricsGrid />
    </div>
  );
}
