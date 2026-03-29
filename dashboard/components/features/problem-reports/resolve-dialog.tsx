"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useResolveProblemReport } from "@/hooks/use-problem-reports"
import {
  resolveProblemReportSchema,
  type ResolveProblemReportFormData,
} from "@/lib/schemas/problem-report.schema"

/* ─── Props ─── */

interface ResolveDialogProps {
  reportId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function ResolveDialog({
  reportId,
  open,
  onOpenChange,
}: ResolveDialogProps) {
  const resolveMutation = useResolveProblemReport()

  const form = useForm<ResolveProblemReportFormData>({
    resolver: zodResolver(resolveProblemReportSchema),
    defaultValues: { status: "resolved", adminNotes: "" },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    if (!reportId) return
    try {
      await resolveMutation.mutateAsync({
        id: reportId,
        status: data.status,
        adminNotes: data.adminNotes || undefined,
      })
      toast.success("Report updated successfully")
      form.reset()
      onOpenChange(false)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update report",
      )
    }
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end" className="overflow-y-auto w-full sm:max-w-[45vw]">
        <SheetHeader>
          <SheetTitle>Resolve Report</SheetTitle>
          <SheetDescription>
            Mark this problem report as resolved or dismissed.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Resolution</Label>
            <Select
              value={form.watch("status")}
              onValueChange={(v) =>
                form.setValue("status", v as "resolved" | "dismissed")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Admin Notes (optional)</Label>
            <Textarea {...form.register("adminNotes")} rows={3} />
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={resolveMutation.isPending}>
              {resolveMutation.isPending ? "Saving..." : "Submit"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
