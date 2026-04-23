"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent } from "@carekit/ui"
import { Label } from "@carekit/ui"
import { Input } from "@carekit/ui"
import { Button } from "@carekit/ui"
import { Skeleton } from "@carekit/ui"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Upload04Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { useLocale } from "@/components/locale-provider"
import { api, getAccessToken } from "@/lib/api"
import type { OrgProfile } from "@/lib/types/organization-profile"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5100/api/v1"

interface Props {
  profile: OrgProfile | null
  isLoading: boolean
  onSave: (data: { nameAr?: string; nameEn?: string; slug?: string; tagline?: string }) => void
  isPending: boolean
}

export function OrganizationProfileForm({ profile, isLoading, onSave, isPending }: Props) {
  const { t } = useLocale()
  const [nameAr, setNameAr] = useState("")
  const [nameEn, setNameEn] = useState("")
  const [slug, setSlug] = useState("")
  const [tagline, setTagline] = useState("")
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [slugError, setSlugError] = useState<string | null>(null)
  const [isCheckingSlug, setIsCheckingSlug] = useState(false)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [debouncedSlug, setDebouncedSlug] = useState("")

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSlug(slug)
    }, 500)
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [slug])

  const checkSlugAvailability = useCallback(async (value: string) => {
    if (!value || value === profile?.slug) {
      setSlugError(null)
      return
    }
    setIsCheckingSlug(true)
    try {
      const token = getAccessToken()
      const res = await fetch(`${API_BASE}/dashboard/organization/profile`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json() as { slug?: string }
      if (data.slug === value) {
        setSlugError(t("settings.organization.slugTaken"))
      } else {
        setSlugError(null)
      }
    } catch {
      setSlugError(null)
    } finally {
      setIsCheckingSlug(false)
    }
  }, [profile?.slug, t])

  useEffect(() => {
    checkSlugAvailability(debouncedSlug)
  }, [debouncedSlug, checkSlugAvailability])

  useEffect(() => {
    if (!profile) return
    setNameAr(profile.nameAr)
    setNameEn(profile.nameEn ?? "")
    setSlug(profile.slug)
    setTagline(profile.tagline ?? "")
    setLogoUrl(profile.logoUrl)
  }, [profile])

  const handleLogoUpload = async (file: File) => {
    setIsUploadingLogo(true)
    try {
      const token = getAccessToken()
      const formData = new FormData()
      formData.append("file", file)

      const uploadRes = await fetch(`${API_BASE}/dashboard/media/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })

      if (!uploadRes.ok) {
        const body = await uploadRes.json().catch(() => ({})) as { message?: string }
        throw new Error(body?.message ?? uploadRes.statusText)
      }

      const uploaded = await uploadRes.json() as { id: string; storageKey: string }

      const presignedRes = await fetch(
        `${API_BASE}/dashboard/media/${uploaded.id}/presigned-url?expirySeconds=31536000`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      )

      if (!presignedRes.ok) {
        const body = await presignedRes.json().catch(() => ({})) as { message?: string }
        throw new Error(body?.message ?? presignedRes.statusText)
      }

      const presignedData = await presignedRes.json() as { url: string }

      const brandingRes = await api.post<{ logoUrl: string }>(
        "/dashboard/organization/branding",
        { logoUrl: presignedData.url }
      )
      setLogoUrl(brandingRes.logoUrl)
      toast.success(t("settings.organization.saved"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.error"))
    } finally {
      setIsUploadingLogo(false)
    }
  }

  const handleSave = () => {
    onSave({
      nameAr,
      nameEn: nameEn || undefined,
      slug,
      tagline: tagline || undefined,
    })
  }

  if (isLoading) {
    return (
      <Card className="p-6 space-y-4">
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      </Card>
    )
  }

  const slugChanged = slug !== profile?.slug

  return (
    <Card className="p-6">
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="nameAr">{t("settings.organization.nameAr")}</Label>
          <Input
            id="nameAr"
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            dir="rtl"
            placeholder="عيادة النجاح"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="nameEn">{t("settings.organization.nameEn")}</Label>
          <Input
            id="nameEn"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            dir="ltr"
            placeholder="Al-Najah Clinic"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">{t("settings.organization.slug")}</Label>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            dir="ltr"
            placeholder="al-najah-clinic"
            className={cn(slugError && "border-destructive")}
          />
          {slugError ? (
            <p className="text-xs text-destructive">{slugError}</p>
          ) : (
            <p className="text-xs text-muted-foreground">{t("settings.organization.slugHint")}</p>
          )}
          {slugChanged && !slugError && (
            <div className="rounded-lg border border-warning/50 bg-warning/10 p-3">
              <p className="text-sm text-warning">{t("settings.organization.slugCaution")}</p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="tagline">{t("settings.organization.tagline")}</Label>
          <Input
            id="tagline"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder={t("settings.organization.taglinePlaceholder")}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("settings.organization.logo")}</Label>
          <div className="flex items-center gap-4">
            {logoUrl && (
              <div className="relative size-16 rounded-lg border overflow-hidden bg-muted">
                <img src={logoUrl} alt="Logo" className="size-full object-contain" />
              </div>
            )}
            <div>
              <input
                type="file"
                id="logo-upload"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleLogoUpload(file)
                }}
                disabled={isUploadingLogo}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={isUploadingLogo}
                onClick={() => document.getElementById("logo-upload")?.click()}
                className="gap-2"
              >
                <HugeiconsIcon icon={Upload04Icon} size={16} />
                {isUploadingLogo
                  ? t("common.uploading")
                  : logoUrl
                    ? t("settings.organization.logoUpload")
                    : t("settings.organization.logo")}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            size="sm"
            disabled={isPending || !!slugError || isCheckingSlug}
            onClick={handleSave}
          >
            {isPending ? t("common.saving") : t("settings.save")}
          </Button>
        </div>
      </div>
    </Card>
  )
}