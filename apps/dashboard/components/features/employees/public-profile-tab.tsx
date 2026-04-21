"use client"

import { useState, useEffect } from "react"
import { useEmployeeMutations } from "@/hooks/use-employee-mutations"
import { Card, CardContent } from "@carekit/ui"
import { Label } from "@carekit/ui"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Button } from "@carekit/ui"
import { useLocale } from "@/components/locale-provider"
import type { Employee, UpdateEmployeePayload } from "@/lib/types/employee"

interface Props {
  employee: Employee
}

function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function PublicProfileTab({ employee }: Props) {
  const { locale } = useLocale()
  const isAr = locale === "ar"
  const { updateMutation } = useEmployeeMutations()

  const [form, setForm] = useState({
    isPublic: employee.isPublic ?? false,
    slug: employee.slug ?? "",
    publicBioAr: employee.publicBioAr ?? "",
    publicBioEn: employee.publicBioEn ?? "",
    publicImageUrl: employee.publicImageUrl ?? "",
  })

  useEffect(() => {
    const seed = `${employee.user.firstName} ${employee.user.lastName}`.trim()
    if (!form.slug && seed) setForm((f) => ({ ...f, slug: slugify(seed) }))
  }, [employee.user.firstName, employee.user.lastName, form.slug])

  const save = async () => {
    const payload: UpdateEmployeePayload = {
      isPublic: form.isPublic,
      slug: form.slug || null,
      publicBioAr: form.publicBioAr || null,
      publicBioEn: form.publicBioEn || null,
      publicImageUrl: form.publicImageUrl || null,
    }
    await updateMutation.mutateAsync({ id: employee.id, ...payload })
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base font-semibold">
              {isAr ? "عرض في الموقع العام" : "Show in public directory"}
            </Label>
            <p className="text-sm text-muted-foreground">
              {isAr ? "اجعل هذا المعالج مرئياً في صفحات الموقع" : "Make this therapist visible on the public site"}
            </p>
          </div>
          <Switch
            checked={form.isPublic}
            onCheckedChange={(v) => setForm((f) => ({ ...f, isPublic: v }))}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>{isAr ? "الرابط الفريد" : "Slug"}</Label>
            <Input
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
              placeholder="dr-khalid"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{isAr ? "صورة الملف العام" : "Public image URL"}</Label>
            <Input
              value={form.publicImageUrl}
              onChange={(e) => setForm((f) => ({ ...f, publicImageUrl: e.target.value }))}
              placeholder="https://..."
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{isAr ? "نبذة عامة (عربي)" : "Public bio (Arabic)"}</Label>
          <Textarea
            rows={4}
            value={form.publicBioAr}
            onChange={(e) => setForm((f) => ({ ...f, publicBioAr: e.target.value }))}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{isAr ? "نبذة عامة (إنجليزي)" : "Public bio (English)"}</Label>
          <Textarea
            rows={4}
            value={form.publicBioEn}
            onChange={(e) => setForm((f) => ({ ...f, publicBioEn: e.target.value }))}
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (isAr ? "جاري الحفظ..." : "Saving...") : (isAr ? "حفظ" : "Save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
