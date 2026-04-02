"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import type { WhiteLabelConfigMap } from "@/lib/types/whitelabel"

interface Props {
  configMap: WhiteLabelConfigMap
  onSave: (configs: { key: string; value: string; type?: string }[]) => void
  isPending: boolean
  t: (key: string) => string
}

export function PaymentTab({ configMap, onSave, isPending, t }: Props) {
  const [moyasarKey, setMoyasarKey] = useState("")
  const [moyasarSecret, setMoyasarSecret] = useState("")
  const [moyasarEnabled, setMoyasarEnabled] = useState(true)
  const [bankEnabled, setBankEnabled] = useState(true)
  const [bankName, setBankName] = useState("")
  const [bankIban, setBankIban] = useState("")
  const [bankHolder, setBankHolder] = useState("")

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMoyasarKey(configMap.moyasar_publishable_key ?? "")
    setMoyasarSecret(configMap.moyasar_secret_key ?? "")
    setMoyasarEnabled(configMap.moyasar_enabled !== "false")
    setBankEnabled(configMap.bank_transfer_enabled !== "false")
    setBankName(configMap.bank_name ?? "")
    setBankIban(configMap.bank_iban ?? "")
    setBankHolder(configMap.bank_account_holder ?? "")
  }, [configMap])

  return (
    <div className="flex flex-col gap-6">
      {/* Moyasar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">{t("settings.moyasar")}</CardTitle>
              <CardDescription>{t("settings.moyasarDesc")}</CardDescription>
            </div>
            <Switch checked={moyasarEnabled} onCheckedChange={setMoyasarEnabled} />
          </div>
        </CardHeader>
        {moyasarEnabled && (
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("settings.moyasarKey")}</Label>
                <Input value={moyasarKey} onChange={(e) => setMoyasarKey(e.target.value)} placeholder="pk_live_..." type="password" />
              </div>
              <div className="space-y-2">
                <Label>{t("settings.moyasarSecret")}</Label>
                <Input value={moyasarSecret} onChange={(e) => setMoyasarSecret(e.target.value)} placeholder="sk_live_..." type="password" />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Bank Transfer */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">{t("settings.bankTransfer")}</CardTitle>
              <CardDescription>{t("settings.bankTransferDesc")}</CardDescription>
            </div>
            <Switch checked={bankEnabled} onCheckedChange={setBankEnabled} />
          </div>
        </CardHeader>
        {bankEnabled && (
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("settings.bankName")}</Label>
                <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Al Rajhi Bank" />
              </div>
              <div className="space-y-2">
                <Label>{t("settings.bankIban")}</Label>
                <Input value={bankIban} onChange={(e) => setBankIban(e.target.value)} placeholder="SA..." className="tabular-nums" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>{t("settings.bankHolder")}</Label>
                <Input value={bankHolder} onChange={(e) => setBankHolder(e.target.value)} />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={isPending}
          onClick={() =>
            onSave([
              { key: "moyasar_publishable_key", value: moyasarKey },
              { key: "moyasar_secret_key", value: moyasarSecret },
              { key: "moyasar_enabled", value: String(moyasarEnabled), type: "boolean" },
              { key: "bank_transfer_enabled", value: String(bankEnabled), type: "boolean" },
              { key: "bank_name", value: bankName },
              { key: "bank_iban", value: bankIban },
              { key: "bank_account_holder", value: bankHolder },
            ])
          }
        >
          {t("settings.save")}
        </Button>
      </div>
    </div>
  )
}
