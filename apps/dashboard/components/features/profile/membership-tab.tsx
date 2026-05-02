"use client"

import { useState, useRef } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { CameraAdd02Icon } from "@hugeicons/core-free-icons"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Input,
  Label,
} from "@deqah/ui"

import { api } from "@/lib/api"
import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/locale-provider"
import { useMemberships, membershipsQueryKey } from "@/hooks/use-memberships"

interface UpdateProfileBody {
  displayName?: string | null
  jobTitle?: string | null
}

interface UpdateProfileResult {
  id: string
  displayName: string | null
  jobTitle: string | null
  avatarUrl: string | null
}

interface UploadAvatarResult {
  membershipId: string
  avatarUrl: string
}

/**
 * Membership tab — edit the per-organization display profile (displayName,
 * jobTitle, avatarUrl) for the caller's currently active Membership. The
 * backend authorization gate already restricts cross-user edits.
 */
export function MembershipTab() {
  const { t, locale } = useLocale()
  const { user } = useAuth()
  const { data: memberships } = useMemberships()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const active =
    memberships?.find((m) => m.organizationId === user?.organizationId) ??
    memberships?.[0] ??
    null

  const [displayName, setDisplayName] = useState(active?.displayName ?? "")
  const [jobTitle, setJobTitle] = useState(active?.jobTitle ?? "")

  const update = useMutation({
    mutationFn: async (body: UpdateProfileBody) => {
      if (!active) throw new Error("No active membership")
      return api.patch<UpdateProfileResult>(
        `/auth/memberships/${active.id}/profile`,
        body,
      )
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: membershipsQueryKey })
      toast.success(t("profile.membership.saved"))
    },
    onError: () => toast.error(t("profile.membership.saveFailed")),
  })

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      if (!active) throw new Error("No active membership")
      const form = new FormData()
      form.append("avatar", file)
      return api.postForm<UploadAvatarResult>(
        `/auth/memberships/${active.id}/avatar`,
        form,
      )
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: membershipsQueryKey })
      toast.success(t("profile.membership.avatarSaved"))
    },
    onError: () => toast.error(t("profile.membership.avatarFailed")),
  })

  if (!active) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <p className="text-sm text-muted-foreground">{t("profile.membership.noActive")}</p>
      </div>
    )
  }

  const orgName = locale === "en" ? active.organization.nameEn ?? active.organization.nameAr : active.organization.nameAr
  const initials = (() => {
    const src = displayName || user?.name || ""
    const parts = src.trim().split(/\s+/).filter(Boolean)
    const i = parts.slice(0, 2).map((p) => p[0]).join("").toUpperCase()
    return i || user?.email?.[0]?.toUpperCase() || "—"
  })()

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadAvatar.mutate(file)
    e.target.value = ""
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    update.mutate({
      displayName: displayName.trim() || null,
      jobTitle: jobTitle.trim() || null,
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <section className="rounded-xl border border-border bg-surface p-6">
        <h3 className="mb-1 text-sm font-semibold text-foreground">
          {t("profile.membership.title")}
        </h3>
        <p className="mb-6 text-xs text-muted-foreground">
          {t("profile.membership.description").replace("{org}", orgName)}
        </p>

        <div className="mb-6 flex items-center gap-4">
          <Avatar className="size-16">
            {active.avatarUrl ? <AvatarImage src={active.avatarUrl} alt={displayName || ""} /> : null}
            <AvatarFallback className="bg-primary text-base font-bold text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={onFileSelected}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={uploadAvatar.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              <HugeiconsIcon icon={CameraAdd02Icon} size={16} />
              {uploadAvatar.isPending
                ? t("profile.membership.avatarUploading")
                : t("profile.membership.avatarUpload")}
            </Button>
            <span className="text-xs text-muted-foreground">
              {t("profile.membership.avatarHint")}
            </span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="membership-display-name">
              {t("profile.membership.displayName")}
            </Label>
            <Input
              id="membership-display-name"
              value={displayName}
              maxLength={120}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={user?.name ?? ""}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="membership-job-title">
              {t("profile.membership.jobTitle")}
            </Label>
            <Input
              id="membership-job-title"
              value={jobTitle}
              maxLength={120}
              onChange={(e) => setJobTitle(e.target.value)}
            />
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </form>
  )
}
