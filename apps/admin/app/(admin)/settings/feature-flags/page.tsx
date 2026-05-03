import { FeatureFlagsTable } from '@/features/feature-flags/feature-flags-table';

export default function FeatureFlagsSettingsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Feature Flags</h1>
        <p className="text-muted-foreground text-sm">
          Toggle platform-level feature gates. Changes take effect within 60 seconds (cache TTL).
        </p>
      </div>
      <FeatureFlagsTable />
    </div>
  );
}
