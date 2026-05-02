"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deqah/ui"

import { api } from "@/lib/api"
import { useLocale } from "@/components/locale-provider"

const ROLES = [
  "OWNER",
  "ADMIN",
  "RECEPTIONIST",
  "DOCTOR",
  "MANAGER",
  "ACCOUNTANT",
] as const

type Role = (typeof ROLES)[number]

interface InvitePayload {
  email: string
  role: Role
  displayName?: string
  jobTitle?: string
}

interface InviteResult {
  invitationId: string
  status: "PENDING"
  expiresAt: string
}

interface InviteUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InviteUserDialog({ open, onOpenChange }: InviteUserDialogProps) {
  const { t } = useLocale()
  const queryClient = useQueryClient()

  const [email, setEmail] = useState("")
  const [role, setRole] = useState<Role>("RECEPTIONIST")
  const [displayName, setDisplayName] = useState("")
  const [jobTitle, setJobTitle] = useState("")

  const reset = () => {
    setEmail("")
    setRole("RECEPTIONIST")
    setDisplayName("")
    setJobTitle("")
  }

  const invite = useMutation({
    mutationFn: (body: InvitePayload) =>
      api.post<InviteResult>("/auth/invitations", body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] })
      toast.success(t("users.invite.toastSent"))
      reset()
      onOpenChange(false)
    },
    onError: (err) => {
      const code = (err as { code?: string }).code
      if (code === "Conflict") {
        toast.error(t("users.invite.toastAlreadyMember"))
      } else {
        toast.error(t("users.invite.toastFailed"))
      }
    },
  })

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!email.trim()) return
    invite.mutate({
      email: email.trim(),
      role,
      displayName: displayName.trim() || undefined,
      jobTitle: jobTitle.trim() || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("users.invite.title")}</DialogTitle>
          <DialogDescription>{t("users.invite.description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-email">{t("users.invite.email")}</Label>
            <Input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ahmad@clinic.sa"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-role">{t("users.invite.role")}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(`users.role.${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-display-name">
              {t("users.invite.displayName")}
            </Label>
            <Input
              id="invite-display-name"
              value={displayName}
              maxLength={120}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t("users.invite.displayNamePlaceholder")}
            />
            <span className="text-xs text-muted-foreground">
              {t("users.invite.displayNameHint")}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-job-title">{t("users.invite.jobTitle")}</Label>
            <Input
              id="invite-job-title"
              value={jobTitle}
              maxLength={120}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder={t("users.invite.jobTitlePlaceholder")}
            />
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={invite.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={invite.isPending}>
              {invite.isPending ? t("users.invite.sending") : t("users.invite.send")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
