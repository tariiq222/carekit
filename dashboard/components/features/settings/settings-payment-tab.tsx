"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useConfigMap, useUpdateConfig } from "@/hooks/use-whitelabel"
import { usePaymentSettings, usePaymentSettingsMutation } from "@/hooks/use-clinic-settings"
import { useLocale } from "@/components/locale-provider"
import { BankAccountCard, SAUDI_BANKS } from "./bank-account-card"
import type { BankAccount } from "./bank-account-card"

/* ─── Helpers ─── */
function generateId() {
  return Math.random().toString(36).slice(2, 9)
}

function parseBankAccounts(raw: string | undefined): BankAccount[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as BankAccount[]
  } catch { /* fall through */ }
  return []
}

function serializeBankAccounts(accounts: BankAccount[]): string {
  return JSON.stringify(accounts)
}

type TabId = "moyasar" | "atclinic" | "bank"

/* ─── Component ─── */
export function SettingsPaymentTab() {
  const { t, locale } = useLocale()
  const { data: configMap, isLoading: configLoading } = useConfigMap()
  const { data: paymentSettings, isLoading: paymentLoading } = usePaymentSettings()
  const updateConfig = useUpdateConfig()
  const paymentMut = usePaymentSettingsMutation()

  const [activeTab, setActiveTab] = useState<TabId>("moyasar")

  const [moyasarKey, setMoyasarKey] = useState("")
  const [moyasarSecret, setMoyasarSecret] = useState("")
  const [bankEnabled, setBankEnabled] = useState(false)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])

  useEffect(() => {
    if (!configMap) return
    setMoyasarKey(configMap.moyasar_publishable_key ?? "")
    setMoyasarSecret(configMap.moyasar_secret_key ?? "")
    setBankEnabled(configMap.bank_transfer_enabled !== "false")

    const rawAccounts = configMap.bank_accounts
    if (rawAccounts) {
      const parsed = parseBankAccounts(rawAccounts)
      if (parsed.length > 0) { setBankAccounts(parsed); return }
    }

    const legacyName = configMap.bank_name ?? ""
    const legacyIban = configMap.bank_iban ?? ""
    const legacyHolder = configMap.bank_account_holder ?? ""
    const legacyBank = SAUDI_BANKS.find(
      (b) => b.nameEn.toLowerCase().includes(legacyName.toLowerCase()) || b.nameAr.includes(legacyName)
    )
    setBankAccounts([{ id: generateId(), bankId: legacyBank?.id ?? "", iban: legacyIban, holderName: legacyHolder }])
  }, [configMap])

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
    updateConfig.mutate(
      { configs: [
        { key: "moyasar_publishable_key", value: moyasarKey },
        { key: "moyasar_secret_key", value: moyasarSecret },
      ]},
      { onSuccess: () => toast.success(t("settings.saved")), onError: () => toast.error(t("settings.error")) }
    )
  }

  const handleSaveBank = () => {
    const first = bankAccounts[0]
    const firstName = first ? (SAUDI_BANKS.find((b) => b.id === first.bankId)?.nameEn ?? "") : ""
    updateConfig.mutate(
      { configs: [
        { key: "bank_transfer_enabled", value: String(bankEnabled), type: "boolean" as const },
        { key: "bank_accounts", value: serializeBankAccounts(bankAccounts), type: "json" as const },
        { key: "bank_name", value: firstName },
        { key: "bank_iban", value: first?.iban ?? "" },
        { key: "bank_account_holder", value: first?.holderName ?? "" },
      ]},
      { onSuccess: () => toast.success(t("settings.saved")), onError: () => toast.error(t("settings.error")) }
    )
  }

  const togglePaymentMethod = (key: "paymentMoyasarEnabled" | "paymentAtClinicEnabled", value: boolean) => {
    paymentMut.mutate(
      { [key]: value },
      { onSuccess: () => toast.success(t("settings.saved")), onError: (err: Error) => toast.error(err.message) }
    )
  }

  if (configLoading || paymentLoading) {
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
    alwaysAvailable?: boolean // content always shown regardless of toggle
    toggleHint?: string       // explains what the toggle actually controls
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

        {/* ── Sidebar Tabs ── */}
        <div className="w-64 shrink-0 border-e border-border bg-surface-muted flex flex-col">
          <div className="p-3 border-b border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("settings.payment.methods")}
            </p>
          </div>
          <div className="flex-1 p-2 space-y-1">
            {tabs.map((tab) => (
              // ✅ div — not button — to avoid nested <button> hydration error (Switch is a button)
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
                {/* Label */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate leading-tight">
                    {tab.label}
                  </p>
                  {activeTab === tab.id && (
                    <p className="text-xs mt-0.5 line-clamp-2 leading-tight opacity-80">
                      {tab.desc}
                    </p>
                  )}
                </div>

                {/* Switch — stopPropagation so it doesn't trigger tab selection */}
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

        {/* ── Content Panel ── */}
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
                <div className="space-y-4 max-w-md">
                  <div>
                    <p className="text-sm font-semibold">{t("settings.moyasar")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("settings.moyasarDesc")}</p>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label>{t("settings.moyasarKey")}</Label>
                    <Input value={moyasarKey} onChange={(e) => setMoyasarKey(e.target.value)} placeholder="pk_live_..." type="password" dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("settings.moyasarSecret")}</Label>
                    <Input value={moyasarSecret} onChange={(e) => setMoyasarSecret(e.target.value)} placeholder="sk_live_..." type="password" dir="ltr" />
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button size="sm" disabled={updateConfig.isPending} onClick={handleSaveMoyasar}>
                      {t("settings.save")}
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === "atclinic" && (
                <div className="space-y-4 max-w-md">
                  <div>
                    <p className="text-sm font-semibold">{t("settings.booking.paymentMethods.atClinic")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("settings.booking.paymentMethods.atClinicDesc")}</p>
                  </div>
                  <Separator />

                  {/* Always-on badge for staff */}
                  <div className="rounded-lg border border-success/20 bg-success/5 p-3 flex items-start gap-3">
                    <div className="h-2 w-2 rounded-full bg-success mt-1 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-success">{t("settings.payment.atClinicAlwaysOn")}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t("settings.payment.atClinicAlwaysOnDesc")}</p>
                    </div>
                  </div>

                  {/* Toggle explanation */}
                  <div className="rounded-lg border border-border bg-surface-muted p-3 flex items-start gap-3">
                    <div className={`h-2 w-2 rounded-full mt-1 shrink-0 ${(paymentSettings?.paymentAtClinicEnabled ?? true) ? "bg-success" : "bg-muted-foreground"}`} />
                    <div>
                      <p className="text-xs font-medium text-foreground">
                        {(paymentSettings?.paymentAtClinicEnabled ?? true)
                          ? t("settings.payment.atClinicPatientOn")
                          : t("settings.payment.atClinicPatientOff")}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t("settings.payment.atClinicToggleHint")}</p>
                    </div>
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

                    {/* Add account — styled as a card to match siblings */}
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
                    <Button size="sm" disabled={updateConfig.isPending} onClick={handleSaveBank}>
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
