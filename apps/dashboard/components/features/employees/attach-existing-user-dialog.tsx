"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@deqah/ui"
import { Input } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { Button } from "@deqah/ui"
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMessage(null)
    mutation.mutate({ identifier, role })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <form onSubmit={handleSubmit}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("employees.attach.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("employees.attach.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="attach-identifier">
                {t("employees.attach.identifierLabel")}
              </Label>
              <Input
                id="attach-identifier"
                type="text"
                placeholder="+966501234567 or user@example.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="attach-role">
                {t("employees.attach.roleLabel")}
              </Label>
              <select
                id="attach-role"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="ADMIN">{t("employees.attach.roleAdmin")}</option>
                <option value="RECEPTIONIST">
                  {t("employees.attach.roleReceptionist")}
                </option>
                <option value="EMPLOYEE">
                  {t("employees.attach.roleEmployee")}
                </option>
                <option value="ACCOUNTANT">
                  {t("employees.attach.roleAccountant")}
                </option>
              </select>
            </div>

            {errorMessage && (
              <p className="text-sm text-destructive">{errorMessage}</p>
            )}
          </div>

          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel type="button" onClick={handleClose}>
              {t("employees.attach.cancel")}
            </AlertDialogCancel>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t("employees.attach.submitting") : t("employees.attach.submit")}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}