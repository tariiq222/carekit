"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@carekit/ui"
import { Button } from "@carekit/ui"
import { Input } from "@carekit/ui"
import { Label } from "@carekit/ui"
import { useLocale } from "@/components/locale-provider"
import { useMemberMutations } from "@/hooks/use-members"
import type { MembershipRole } from "@/lib/types/members"

const ROLES: MembershipRole[] = ["OWNER", "ADMIN", "RECEPTIONIST", "ACCOUNTANT", "EMPLOYEE"]

interface InviteMemberDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InviteMemberDialog({ open, onOpenChange }: InviteMemberDialogProps) {
  const { t } = useLocale()
  const { inviteMut } = useMemberMutations()
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<MembershipRole>("RECEPTIONIST")
  const [emailError, setEmailError] = useState<string | null>(null)

  const handleSubmit = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setEmailError(t("members.invalidEmail"))
      return
    }
    setEmailError(null)

    try {
      await inviteMut.mutateAsync({ email, role })
      setEmail("")
      setRole("RECEPTIONIST")
      onOpenChange(false)
    } catch {
      // Error handled by hook
    }
  }

  const handleClose = (open: boolean) => {
    if (!open) {
      setEmail("")
      setRole("RECEPTIONIST")
      setEmailError(null)
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("members.invite.title")}</DialogTitle>
          <DialogDescription>{t("members.invite.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">{t("members.email")}</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError(null) }}
              placeholder="user@example.com"
              dir="ltr"
              className={emailError ? "border-destructive" : ""}
            />
            {emailError && <p className="text-xs text-destructive">{emailError}</p>}
          </div>

          <div className="space-y-2">
            <Label>{t("members.role")}</Label>
            <div className="space-y-2">
              {ROLES.map((r) => (
                <label
                  key={r}
                  className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted"
                >
                  <input
                    type="radio"
                    name="role"
                    value={r}
                    checked={role === r}
                    onChange={() => setRole(r)}
                    className="accent-primary"
                  />
                  <span>{t(`members.role.${r.toLowerCase()}`)}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={inviteMut.isPending || !email}
            onClick={handleSubmit}
          >
            {inviteMut.isPending ? t("common.saving") : t("members.invite.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}