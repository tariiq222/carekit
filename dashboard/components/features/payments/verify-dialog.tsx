"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
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

import { usePaymentMutations } from "@/hooks/use-payments"
import {
  verifyTransferSchema,
  type VerifyTransferFormData,
} from "@/lib/schemas/payment.schema"

/* ─── Props ─── */

interface VerifyDialogProps {
  paymentId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

/* ─── Component ─── */

export function VerifyDialog({
  paymentId,
  open,
  onOpenChange,
  onSuccess,
}: VerifyDialogProps) {
  const { verifyMut } = usePaymentMutations()

  const form = useForm<VerifyTransferFormData>({
    resolver: zodResolver(verifyTransferSchema),
    defaultValues: { action: undefined, adminNotes: "" },
  })

  const onSubmit = form.handleSubmit(async (data: VerifyTransferFormData) => {
    try {
      await verifyMut.mutateAsync({
        id: paymentId,
        action: data.action,
        adminNotes: data.adminNotes || undefined,
      })
      toast.success(
        data.action === "approve" ? "Transfer approved" : "Transfer rejected",
      )
      form.reset()
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed")
    }
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="end"
        className="overflow-y-auto w-full sm:max-w-[45vw]"
      >
        <SheetHeader>
          <SheetTitle>Verify Bank Transfer</SheetTitle>
          <SheetDescription>
            Approve or reject this bank transfer payment.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Action</Label>
            <Select
              value={form.watch("action") ?? ""}
              onValueChange={(v) =>
                form.setValue("action", v as "approve" | "reject", {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="approve">Approve</SelectItem>
                <SelectItem value="reject">Reject</SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.action && (
              <p className="text-xs text-destructive">
                {form.formState.errors.action.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="verify-notes">Admin Notes (optional)</Label>
            <Textarea
              id="verify-notes"
              placeholder="Internal notes..."
              rows={3}
              {...form.register("adminNotes")}
            />
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={verifyMut.isPending}>
              {verifyMut.isPending ? "Processing..." : "Confirm"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
