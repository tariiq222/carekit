"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Card, CardContent } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { Input } from "@deqah/ui"
import { Button } from "@deqah/ui"
import { Skeleton } from "@deqah/ui"
import { useOrganizationSettings, useUpdateOrganizationSettings } from "@/hooks/use-organization-settings"
import { useLocale } from "@/components/locale-provider"

export function EntityTab() {
  const { t } = useLocale()
  const { data: settings, isLoading } = useOrganizationSettings()
  const updateSettings = useUpdateOrganizationSettings()

  const [companyNameAr, setCompanyNameAr] = useState("")
  const [companyNameEn, setCompanyNameEn] = useState("")
  const [businessRegistration, setBusinessRegistration] = useState("")
  const [vatRegistrationNumber, setVatRegistrationNumber] = useState("")
  const [vatRate, setVatRate] = useState("15")
  const [sellerAddress, setSellerAddress] = useState("")
  const [organizationCity, setClinicCity] = useState("")
  const [postalCode, setPostalCode] = useState("")

  useEffect(() => {
    if (!settings) return
    // Seed editable form fields from server settings; user edits locally and saves explicitly.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCompanyNameAr(settings.companyNameAr ?? "")
    setCompanyNameEn(settings.companyNameEn ?? "")
    setBusinessRegistration(settings.businessRegistration ?? "")
    setVatRegistrationNumber(settings.vatRegistrationNumber ?? "")
    setVatRate(String(settings.vatRate ?? 15))
    setSellerAddress(settings.sellerAddress ?? "")
    setClinicCity(settings.organizationCity ?? "")
    setPostalCode(settings.postalCode ?? "")
  }, [settings])

  const handleSave = () => {
    updateSettings.mutate(
      {
        companyNameAr: companyNameAr || null,
        companyNameEn: companyNameEn || null,
        businessRegistration: businessRegistration || null,
        vatRegistrationNumber: vatRegistrationNumber || null,
        vatRate: Number(vatRate),
        sellerAddress: sellerAddress || null,
        organizationCity,
        postalCode: postalCode || null,
      },
      {
        onSuccess: () => toast.success(t("settings.saved")),
        onError: () => toast.error(t("settings.error")),
      },
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-warning/20 bg-warning/5 px-4 py-3">
        <p className="text-sm text-warning-foreground">
          {t("settings.entity.warning")}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("settings.entity.companyNameAr")}</Label>
              <Input value={companyNameAr} onChange={(e) => setCompanyNameAr(e.target.value)} dir="rtl" />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.entity.companyNameEn")}</Label>
              <Input value={companyNameEn} onChange={(e) => setCompanyNameEn(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.entity.businessRegistration")}</Label>
              <Input value={businessRegistration} onChange={(e) => setBusinessRegistration(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.entity.vatRegistration")}</Label>
              <Input value={vatRegistrationNumber} onChange={(e) => setVatRegistrationNumber(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.entity.vatRate")}</Label>
              <Input value={vatRate} onChange={(e) => setVatRate(e.target.value)} type="number" min="0" max="100" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.entity.sellerAddress")}</Label>
              <Input value={sellerAddress} onChange={(e) => setSellerAddress(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.entity.organizationCity")}</Label>
              <Input value={organizationCity} onChange={(e) => setClinicCity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.entity.postalCode")}</Label>
              <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} dir="ltr" />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button size="sm" disabled={updateSettings.isPending} onClick={handleSave}>
              {t("settings.save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
