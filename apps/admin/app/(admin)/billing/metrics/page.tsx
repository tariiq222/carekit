import { BillingMetricsGrid } from '@/features/billing/get-billing-metrics/billing-metrics-grid';

export default function BillingMetricsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Billing — Metrics</h2>
        <p className="text-sm text-muted-foreground">
          MRR, ARR, churn, and per-plan revenue breakdown across all tenants.
        </p>
      </div>
      <BillingMetricsGrid />
    </div>
  );
}
