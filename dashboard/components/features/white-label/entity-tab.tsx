"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert01Icon } from "@hugeicons/core-free-icons"
import type { WhiteLabelConfigMap } from "@/lib/types/whitelabel"

interface Props {
  configMap: WhiteLabelConfigMap
  onSave: (configs: { key: string; value: string; type?: string }[]) => void
  isPending: boolean
  t: (key: string) => string
}

export function EntityTab({ configMap, onSave, isPending, t }: Props) {
  const [companyNameAr, setCompanyNameAr] = useState("")
  const [companyNameEn, setCompanyNameEn] = useState("")
  const [crNumber, setCrNumber] = useState("")
  const [vatNumber, setVatNumber] = useState("")
  const [address, setAddress] = useState("")
  const [city, setCity] = useState("")
  const [postalCode, setPostalCode] = useState("")

  useEffect(() => {
    setCompanyNameAr(configMap.company_name_ar ?? "")
    setCompanyNameEn(configMap.company_name_en ?? "")
    setCrNumber(configMap.business_registration ?? "")
    setVatNumber(configMap.vat_registration_number ?? "")
    setAddress(configMap.seller_address ?? "")
    setCity(configMap.clinic_city ?? "")
    setPostalCode(configMap.postal_code ?? "")
  }, [configMap])

  return (
    <div className="space-y-6">
      {/* Warning banner */}
      <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/8 px-4 py-3">
        <HugeiconsIcon icon={Alert01Icon} size={18} className="mt-0.5 shrink-0 text-warning" />
        <p className="text-sm text-warning">{t("whiteLabel.entityWarning")}</p>
      </div>

      {/* Company legal data */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("whiteLabel.companyData")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("whiteLabel.companyNameAr")}</Label>
              <Input value={companyNameAr} onChange={(e) => setCompanyNameAr(e.target.value)} dir="rtl" placeholder="شركة الصحة المتكاملة" />
            </div>
            <div className="space-y-2">
              <Label>{t("whiteLabel.companyNameEn")}</Label>
              <Input value={companyNameEn} onChange={(e) => setCompanyNameEn(e.target.value)} dir="ltr" placeholder="Integrated Health Co." />
            </div>
            <div className="space-y-2">
              <Label>{t("whiteLabel.crNumber")}</Label>
              <Input value={crNumber} onChange={(e) => setCrNumber(e.target.value)} dir="ltr" placeholder="1010..." className="tabular-nums" />
            </div>
            <div className="space-y-2">
              <Label>{t("whiteLabel.vatNumber")}</Label>
              <Input value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} dir="ltr" placeholder="3..." className="tabular-nums" />
            </div>
          </div>
          <Separator />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>{t("whiteLabel.invoiceAddress")}</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("whiteLabel.city")}</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("whiteLabel.postalCode")}</Label>
              <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} dir="ltr" className="tabular-nums" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" disabled={isPending} onClick={() => onSave([
              { key: "company_name_ar", value: companyNameAr },
              { key: "company_name_en", value: companyNameEn },
              { key: "business_registration", value: crNumber },
              { key: "vat_registration_number", value: vatNumber },
              { key: "seller_address", value: address },
              { key: "clinic_city", value: city },
              { key: "postal_code", value: postalCode },
            ])}>
              {t("settings.save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
