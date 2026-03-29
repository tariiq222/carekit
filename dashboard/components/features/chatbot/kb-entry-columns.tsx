import { type ColumnDef } from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete02Icon } from "@hugeicons/core-free-icons"

import { Badge } from "@/components/ui/badge"
import type { KnowledgeBaseEntry } from "@/lib/types/chatbot"

export function getEntryColumns(
  onDelete: (id: string) => void,
  t: (key: string) => string,
): ColumnDef<KnowledgeBaseEntry, unknown>[] {
  return [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => (
        <span className="text-sm font-medium text-foreground">
          {row.original.title}
        </span>
      ),
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.category ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "source",
      header: "Source",
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs">
          {row.original.source ?? "manual"}
        </Badge>
      ),
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) =>
        row.original.isActive ? (
          <Badge variant="default">Active</Badge>
        ) : (
          <Badge variant="secondary">Inactive</Badge>
        ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <button
          className="flex size-9 items-center justify-center rounded-sm border border-transparent text-muted-foreground transition-all duration-200 hover:bg-destructive/10 hover:border-destructive/20 hover:text-destructive"
          onClick={() => onDelete(row.original.id)}
          aria-label={t("chatbot.kb.deleteEntry")}
        >
          <HugeiconsIcon icon={Delete02Icon} size={16} />
        </button>
      ),
    },
  ]
}
