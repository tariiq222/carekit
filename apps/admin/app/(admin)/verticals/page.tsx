'use client';

import { useListVerticals } from '@/features/verticals/list-verticals/use-list-verticals';
import { VerticalsTable } from '@/features/verticals/list-verticals/verticals-table';

export default function VerticalsPage() {
  const { data, isLoading, error } = useListVerticals();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Verticals</h2>
        <p className="text-sm text-muted-foreground">
          Clinic archetypes that drive terminology + seed content. Create/update/delete via the
          API (dedicated UI lands in a follow-up).
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load: {(error as Error).message}
        </div>
      ) : null}

      <VerticalsTable items={data} isLoading={isLoading} />
    </div>
  );
}
