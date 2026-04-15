"use client"

/* ─── Props ─── */

interface ServiceBranchesTabProps {
  serviceId?: string | undefined
}

/* ─── Component ─── */

export function ServiceBranchesTab(_props: ServiceBranchesTabProps) {
  return (
    <div className="rounded-lg border border-border bg-surface-muted p-6 flex flex-col gap-3">
      <p className="text-sm font-semibold text-foreground">Branch Assignment</p>
      <p className="text-sm text-muted-foreground">
        Branch assignment is managed at the branch level.
      </p>
    </div>
  )
}
