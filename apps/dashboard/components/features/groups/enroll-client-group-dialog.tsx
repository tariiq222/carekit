"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useLocale } from "@/components/locale-provider"
import { useGroupsMutations } from "@/hooks/use-groups-mutations"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Props {
  open: boolean
  onClose: () => void
  groupId: string
}

export function EnrollClientGroupDialog({ open, onClose, groupId }: Props) {
  const { t } = useLocale()
  const { enrollClientMut } = useGroupsMutations()
  const [clientId, setClientId] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId.trim()) return
    try {
      await enrollClientMut.mutateAsync({ groupId, clientId: clientId.trim() })
      toast.success(t("groups.clientEnrolled"))
      setClientId("")
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("groups.addClient")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label>{t("groups.clientId")}</Label>
            <Input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder={t("groups.clientIdPlaceholder")}
            />
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button
            onClick={handleSubmit}
            disabled={enrollClientMut.isPending || !clientId.trim()}
          >
            {enrollClientMut.isPending ? t("common.saving") : t("groups.enroll")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
