"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"
import { Card, CardContent } from "@carekit/ui"
import { Label } from "@carekit/ui"
import { Input } from "@carekit/ui"
import { Button } from "@carekit/ui"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@carekit/ui"
import { Skeleton } from "@carekit/ui"
import { cn } from "@/lib/utils"
import { useOrganizationIntegrations, useUpdateOrganizationIntegrations } from "@/hooks/use-organization-integrations"
import { usePaymentSettings, usePaymentSettingsMutation } from "@/hooks/use-organization-settings"
import { useLocale } from "@/components/locale-provider"
import { BankAccountCard, SAUDI_BANKS } from "./bank-account-card"
import type { BankAccount } from "./bank-account-card"

function generateId() {
  return Math.random().toString(36).slice(2, 9)
}

type TabId = "moyasar" | "atclinic" | "bank"

export function SettingsPaymentTab() {
  const { t, locale } = useLocale()
  const { data: integrations, isLoading: integrationsLoading } = useOrganizationIntegrations()
  const { data: paymentSettings, isLoading: paymentLoading } = usePaymentSettings()
  const updateIntegrations = useUpdateOrganizationIntegrations()
  const paymentMut = usePaymentSettingsMutation()

  const [activeTab, setActiveTab] = useState<TabId>("moyasar")

  const [moyasarKey, setMoyasarKey] = useState("")
  const [moyasarSecret, setMoyasarSecret] = useState("")
  const [bankEnabled, setBankEnabled] = useState(false)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])

  useEffect(() => {
    if (!integrations) return
    // Seed editable form fields from async-loaded integrations; user edits locally and saves explicitly.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMoyasarKey(integrations.moyasarPublishableKey ?? "")
    setMoyasarSecret(integrations.moyasarSecretKey ?? "")
    setBankEnabled(!!integrations.bankName || !!integrations.bankIban)

    const legacyName = integrations.bankName ?? ""
    const legacyIban = integrations.bankIban ?? ""
    const legacyHolder = integrations.bankAccountHolder ?? ""
    const legacyBank = SAUDI_BANKS.find(
      (b) => b.nameEn.toLowerCase().includes(legacyName.toLowerCase()) || b.nameAr.includes(legacyName)
    )
    if (legacyIban || legacyHolder || legacyName) {
      setBankAccounts([{ id: generateId(), bankId: legacyBank?.id ?? "", iban: legacyIban, holderName: legacyHolder }])
    } else {
      setBankAccounts([{ id: generateId(), bankId: "", iban: "", holderName: "" }])
    }
  }, [integrations])

  const handleAddAccount = useCallback(() => {
    setBankAccounts((prev) => [...prev, { id: generateId(), bankId: "", iban: "", holderName: "" }])
  }, [])

  const handleRemoveAccount = useCallback((id: string) => {
    setBankAccounts((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const handleUpdateAccount = useCallback(
    (id: string, field: keyof Omit<BankAccount, "id">, value: string) => {
      setBankAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, [field]: value } : a)))
    }, []
  )

  const handleSaveMoyasar = () => {
    const payload: Record<string, string | null> = {
      moyasarPublishableKey: moyasarKey,
    }
    if (moyasarSecret && moyasarSecret !== "***") {
      payload.moyasarSecretKey = moyasarSecret
    }
    updateIntegrations.mutate(payload, {
      onSuccess: () => toast.success(t("settings.saved")),
      onError: () => toast.error(t("settings.error")),
    })
  }

  const handleSaveBank = () => {
    const first = bankAccounts[0]
    const firstName = first ? (SAUDI_BANKS.find((b) => b.id === first.bankId)?.nameEn ?? "") : ""
    const payload: Record<string, string | null> = {
      bankName: firstName,
    }
    if (first?.iban && first.iban !== "***") {
      payload.bankIban = first.iban
    }
    if (first?.holderName && first.holderName !== "***") {
      payload.bankAccountHolder = first.holderName
    }
    updateIntegrations.mutate(payload, {
      onSuccess: () => toast.success(t("settings.saved")),
      onError: () => toast.error(t("settings.error")),
    })
  }

  const togglePaymentMethod = (key: "paymentMoyasarEnabled" | "paymentAtClinicEnabled", value: boolean) => {
    paymentMut.mutate(
      { [key]: value },
      { onSuccess: () => toast.success(t("settings.saved")), onError: (err: Error) => toast.error(err.message) }
    )
  }

  if (integrationsLoading || paymentLoading) {
    return (
      <div className="flex gap-0 rounded-xl border border-border overflow-hidden">
        <div className="w-64 border-e border-border bg-surface-muted space-y-1 p-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
        <div className="flex-1 p-6"><Skeleton className="h-48 rounded-lg" /></div>
      </div>
    )
  }

  const tabs: {
    id: TabId
    label: string
    desc: string
    enabled: boolean
    onToggle: (v: boolean) => void
    alwaysAvailable?: boolean
    toggleHint?: string
  }[] = [
    {
      id: "moyasar",
      label: t("settings.booking.paymentMethods.moyasar"),
      desc: t("settings.booking.paymentMethods.moyasarDesc"),
      enabled: paymentSettings?.paymentMoyasarEnabled ?? false,
      onToggle: (v) => togglePaymentMethod("paymentMoyasarEnabled", v),
    },
    {
      id: "atclinic",
      label: t("settings.booking.paymentMethods.atClinic"),
      desc: t("settings.booking.paymentMethods.atClinicDesc"),
      enabled: paymentSettings?.paymentAtClinicEnabled ?? true,
      onToggle: (v) => togglePaymentMethod("paymentAtClinicEnabled", v),
      alwaysAvailable: true,
      toggleHint: t("settings.payment.atClinicToggleHint"),
    },
    {
      id: "bank",
      label: t("settings.bankTransfer"),
      desc: t("settings.bankTransferDesc"),
      enabled: bankEnabled,
      onToggle: setBankEnabled,
    },
  ]

  const activeTabDef = tabs.find((tab) => tab.id === activeTab)!

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex min-h-[420px]">
        <div className="w-64 shrink-0 border-e border-border bg-surface-muted flex flex-col">
          <div className="p-3 border-b border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("settings.payment.methods")}
            </p>
          </div>
          <div className="flex-1 p-2 space-y-1">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                tabIndex={0}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setActiveTab(tab.id) }}
                className={cn(
                  "w-full flex items-center justify-between gap-3 rounded-lg px-3 py-3 cursor-pointer select-none transition-colors",
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate leading-tight">{tab.label}</p>
                  {activeTab === tab.id && (
                    <p className="text-xs mt-0.5 line-clamp-2 leading-tight opacity-80">{tab.desc}</p>
                  )}
                </div>
                <div
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="shrink-0 flex flex-col items-center gap-0.5"
                  title={tab.toggleHint}
                >
                  <Switch
                    checked={tab.enabled}
                    onCheckedChange={tab.onToggle}
                    disabled={paymentMut.isPending}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 p-6">
          {(!activeTabDef.enabled && !activeTabDef.alwaysAvailable) ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center gap-3">
              <div className="h-12 w-12 rounded-full bg-surface-muted flex items-center justify-center border border-border">
                <Switch checked={false} disabled className="scale-75 pointer-events-none" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{activeTabDef.label}</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  {t("settings.payment.disabledHint")}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => activeTabDef.onToggle(true)}
                disabled={paymentMut.isPending}
              >
                {t("settings.payment.enable")}
              </Button>
            </div>
          ) : (
            <>
              {activeTab === "moyasar" && (
                <div className="flex flex-col gap-3 h-full">
                  <div className="grid grid-cols-2 gap-3">
                    <Card className="shadow-sm bg-surface">
                      <CardContent className="space-y-2 pt-3 pb-3">
                        <Label>{t("settings.moyasarKey")}</Label>
                        <Input value={moyasarKey} onChange={(e) => setMoyasarKey(e.target.value)} placeholder="pk_live_..." type="password" dir="ltr" />
                      </CardContent>
                    </Card>
                    <Card className="shadow-sm bg-surface">
                      <CardContent className="space-y-2 pt-3 pb-3">
                        <Label>{t("settings.moyasarSecret")}</Label>
                        <Input value={moyasarSecret} onChange={(e) => setMoyasarSecret(e.target.value)} placeholder={moyasarSecret === "***" ? "............" : "sk_live_..."} type="password" dir="ltr" />
                      </CardContent>
                    </Card>
                  </div>
                  <div className="flex justify-end mt-auto pt-2">
                    <Button size="sm" disabled={updateIntegrations.isPending} onClick={handleSaveMoyasar}>
                      {t("settings.save")}
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === "atclinic" && (
                <div className="flex flex-col gap-3 h-full">
                  <div className="grid grid-cols-2 gap-3">
                    <Card className="shadow-sm bg-surface border-success/20 bg-success/5">
                      <CardContent className="pt-3 pb-3 flex items-start gap-3">
                        <div className="h-2 w-2 rounded-full bg-success mt-1 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-success">{t("settings.payment.atClinicAlwaysOn")}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{t("settings.payment.atClinicAlwaysOnDesc")}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="shadow-sm bg-surface">
                      <CardContent className="pt-3 pb-3 flex items-start gap-3">
                        <div className={`h-2 w-2 rounded-full mt-1 shrink-0 ${(paymentSettings?.paymentAtClinicEnabled ?? true) ? "bg-success" : "bg-muted-foreground"}`} />
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {(paymentSettings?.paymentAtClinicEnabled ?? true)
                              ? t("settings.payment.atClinicClientOn")
                              : t("settings.payment.atClinicClientOff")}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{t("settings.payment.atClinicToggleHint")}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {activeTab === "bank" && (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold">{t("settings.bankTransfer")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("settings.bankTransferDesc")}</p>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {bankAccounts.map((account, index) => (
                      <BankAccountCard
                        key={account.id}
                        account={account}
                        index={index}
                        onUpdate={handleUpdateAccount}
                        onRemove={handleRemoveAccount}
                        canRemove={bankAccounts.length > 1}
                        t={t}
                        locale={locale}
                      />
                    ))}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={handleAddAccount}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleAddAccount() }}
                      className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-surface min-h-[200px] cursor-pointer select-none transition-colors hover:border-primary/40 hover:bg-primary/5 group"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-muted transition-colors group-hover:border-primary/30 group-hover:bg-primary/10">
                        <HugeiconsIcon icon={Add01Icon} size={20} className="text-muted-foreground transition-colors group-hover:text-primary" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground transition-colors group-hover:text-primary">
                        {t("settings.bankTransfer.addAccount")}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button size="sm" disabled={updateIntegrations.isPending} onClick={handleSaveBank}>
                      {t("settings.save")}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  )
}
