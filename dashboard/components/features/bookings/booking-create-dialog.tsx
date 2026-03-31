"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useLocale } from "@/components/locale-provider"
import { BookingWizard } from "./booking-wizard"

interface BookingCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function BookingCreateDialog({
  open,
  onOpenChange,
  onSuccess,
}: BookingCreateDialogProps) {
  const { t } = useLocale()

  function handleSuccess() {
    onOpenChange(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("bookings.create.dialogTitle")}</DialogTitle>
        </DialogHeader>
        <BookingWizard
          onSuccess={handleSuccess}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
