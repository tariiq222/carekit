"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, UserAdd01Icon } from "@hugeicons/core-free-icons"

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@deqah/ui"
import { Input } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { Button } from "@deqah/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { attachMembership } from "@/lib/api/employees"
import { queryKeys } from "@/lib/query-keys"

interface AttachExistingUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AttachExistingUserDialog({
  open,
  onOpenChange,
}: AttachExistingUserDialogProps) {
  const { t } = useLocale()
  const queryClient = useQueryClient()
  const [identifier, setIdentifier] = useState("")
  const [role, setRole] = useState("EMPLOYEE")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (payload: { identifier: string; role: string }) =>
      attachMembership(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.stats() })
      toast.success(t("employees.attach.success"))
      handleClose()
    },
    onError: (err: { message?: string }) => {
      const msg = err?.message ?? ""
      if (msg.includes("USER_NOT_REGISTERED") || msg.includes("404")) {
        setErrorMessage(t("employees.attach.userNotFound"))
      } else if (msg.includes("MEMBERSHIP_EXISTS") || msg.includes("409")) {
        setErrorMessage(t("employees.attach.membershipExists"))
      } else {
        toast.error(t("employees.attach.error"))
      }
    },
  })

  function handleClose() {
    setIdentifier("")
    setRole("EMPLOYEE")
    setErrorMessage(null)
    onOpenChange(false)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      onOpenChange(true)
      return
    }
    handleClose()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMessage(null)
    mutation.mutate({ identifier: identifier.trim(), role })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md">
        <DialogHeader className="pe-14">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <HugeiconsIcon icon={UserAdd01Icon} size={18} strokeWidth={1.8} />
            </span>
            <div className="min-w-0 space-y-1">
              <DialogTitle>{t("employees.attach.title")}</DialogTitle>
              <DialogDescription>
                {t("employees.attach.description")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form id="attach-existing-user-form" onSubmit={handleSubmit}>
          <DialogBody className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="attach-identifier">
                {t("employees.attach.identifierLabel")}
              </Label>
              <div className="relative">
                <HugeiconsIcon
                  icon={Search01Icon}
                  size={16}
                  strokeWidth={1.8}
                  className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="attach-identifier"
                  type="text"
                  inputMode="email"
                  autoComplete="email tel"
                  placeholder={t("employees.attach.identifierPlaceholder")}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="ps-9"
                  aria-invalid={Boolean(errorMessage)}
                  aria-describedby={
                    errorMessage ? "attach-error" : "attach-identifier-help"
                  }
                  required
                />
              </div>
              <p
                id="attach-identifier-help"
                className="text-xs leading-5 text-muted-foreground"
              >
                {t("employees.attach.identifierHelp")}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="attach-role">
                {t("employees.attach.roleLabel")}
              </Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="attach-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">
                    {t("employees.attach.roleAdmin")}
                  </SelectItem>
                  <SelectItem value="RECEPTIONIST">
                    {t("employees.attach.roleReceptionist")}
                  </SelectItem>
                  <SelectItem value="EMPLOYEE">
                    {t("employees.attach.roleEmployee")}
                  </SelectItem>
                  <SelectItem value="ACCOUNTANT">
                    {t("employees.attach.roleAccountant")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {errorMessage && (
              <p
                id="attach-error"
                className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm leading-6 text-destructive"
              >
                {errorMessage}
              </p>
            )}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              {t("employees.attach.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || identifier.trim().length < 3}
            >
              {mutation.isPending
                ? t("employees.attach.submitting")
                : t("employees.attach.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
