"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete02Icon, ArrowDown01Icon, Building01Icon, Tick01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@carekit/ui"
import { Input } from "@carekit/ui"
import { Label } from "@carekit/ui"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@carekit/ui"

/* ─── Saudi Banks — full SAMA licensed list ─── */
/**
 * EXCEPTION (semantic-tokens-only rule): the `color` field below is each
 * bank's official external brand color (SAMA-licensed institutions). These
 * render the fallback chip when the favicon CDN is unreachable, so they
 * MUST stay as literal hex — they are not theme surfaces and must not
 * follow the per-tenant branding tokens.
 */
export interface SaudiBank {
  id: string
  nameAr: string
  nameEn: string
  domain: string      // official website domain for Google favicon API
  faviconUrl?: string // direct favicon URL override (when Google API fails)
  color: string       // fallback bg color
  initials: string    // fallback text
}

export const SAUDI_BANKS: SaudiBank[] = [
  // ── Local banks (SAMA list) ──
  { id: "alrajhi",  nameAr: "مصرف الراجحي",           nameEn: "Al Rajhi Bank",           domain: "alrajhibank.com.sa", color: "#006400", initials: "AR" },
  { id: "snb",      nameAr: "البنك الأهلي السعودي",    nameEn: "Saudi National Bank",     domain: "alahli.com",         faviconUrl: "https://www.alahli.com/-/media/project/snb/shared/icons/favicon.png", color: "#1B4F72", initials: "SN" },
  { id: "riyad",    nameAr: "بنك الرياض",              nameEn: "Riyad Bank",              domain: "riyadbank.com",      color: "#C8102E", initials: "RB" },
  { id: "sabb",     nameAr: "البنك السعودي البريطاني", nameEn: "Saudi British Bank",      domain: "sabb.com",           color: "#DB0011", initials: "SB" },
  { id: "anb",      nameAr: "البنك العربي الوطني",     nameEn: "Arab National Bank",      domain: "anb.com.sa",         faviconUrl: "https://anb.com.sa/o/anb-theme/images/favicon.ico", color: "#1A3A6B", initials: "AN" },
  { id: "alinma",   nameAr: "مصرف الإنماء",            nameEn: "Alinma Bank",             domain: "alinma.com",         color: "#00704A", initials: "AI" },
  { id: "bsf",      nameAr: "البنك السعودي الفرنسي",   nameEn: "Banque Saudi Fransi",     domain: "bsf.sa",             faviconUrl: "https://bsf.sa/images/favicon.png", color: "#003087", initials: "SF" },
  { id: "saib",     nameAr: "البنك السعودي للاستثمار", nameEn: "Saudi Investment Bank",   domain: "saib.com.sa",        color: "#8B1A1A", initials: "SI" },
  { id: "aljazira", nameAr: "بنك الجزيرة",             nameEn: "Bank AlJazira",           domain: "bankaljazira.com.sa",faviconUrl: "https://www.aljazirabank.com.sa/Portals/0/Images/ajb-logo.ico", color: "#8B0000", initials: "AJ" },
  { id: "albilad",  nameAr: "بنك البلاد",              nameEn: "Bank Albilad",            domain: "bankalbilad.com.sa", faviconUrl: "https://www.bankalbilad.com.sa/SiteAssets/favicon.ico", color: "#006633", initials: "AB" },
  { id: "gib",      nameAr: "بنك الخليج الدولي",       nameEn: "Gulf International Bank", domain: "gibonline.com",      color: "#154360", initials: "GI" },
  // ── Foreign bank branches ──
  { id: "enbd",     nameAr: "بنك الإمارات دبي الوطني", nameEn: "Emirates NBD",            domain: "emiratesnbd.com.sa", faviconUrl: "https://www.emiratesnbd.com.sa/-/media/enbd/images/logos/favicon.png", color: "#C0392B", initials: "EN" },
  { id: "nbb",      nameAr: "بنك البحرين الوطني",      nameEn: "National Bank of Bahrain", domain: "nbbonline.com",     color: "#003366", initials: "NB" },
  { id: "nbk",      nameAr: "بنك الكويت الوطني",       nameEn: "National Bank of Kuwait", domain: "nbk.com",            color: "#003366", initials: "NK" },
  { id: "bankmuscat",nameAr: "بنك مسقط",               nameEn: "Bank Muscat",             domain: "bankmuscat.com",     color: "#8B0000", initials: "BM" },
  { id: "deutsche", nameAr: "دويتشه بنك",              nameEn: "Deutsche Bank",           domain: "db.com",             color: "#003189", initials: "DB" },
  { id: "bnp",      nameAr: "بي إن باريبا",            nameEn: "BNP Paribas",             domain: "bnpparibas.com",     color: "#00965E", initials: "BP" },
  { id: "jpmorgan", nameAr: "جي بي مورقان",            nameEn: "JP Morgan Chase",         domain: "jpmorgan.com",       color: "#003087", initials: "JP" },
  { id: "qnb",      nameAr: "بنك قطر الوطني",          nameEn: "Qatar National Bank",     domain: "qnb.com",            color: "#5C0F8B", initials: "QN" },
  { id: "mufg",     nameAr: "بنك MUFG",                nameEn: "MUFG Bank",               domain: "mufg.jp",            color: "#C8102E", initials: "MU" },
  { id: "fab",      nameAr: "بنك أبوظبي الأول",        nameEn: "First Abu Dhabi Bank",    domain: "bankfab.com",        color: "#003087", initials: "FA" },
  { id: "sc",       nameAr: "بنك ستاندرد تشارترد",     nameEn: "Standard Chartered",      domain: "sc.com",             color: "#00A3E0", initials: "SC" },
  // ── Digital banks ──
  { id: "stcbank",  nameAr: "بنك STC",                 nameEn: "STC Bank",                domain: "stcbank.com.sa",     color: "#6C3483", initials: "ST" },
  { id: "d360",     nameAr: "البنك السعودي الرقمي",    nameEn: "D360 Bank",               domain: "d360.com",           faviconUrl: "https://d360.com/favicon.ico", color: "#1A1A2E", initials: "D3" },
]

function getBankLogoUrl(bank: SaudiBank) {
  if (bank.faviconUrl) return bank.faviconUrl
  return `https://www.google.com/s2/favicons?domain=${bank.domain}&sz=64`
}

/* ─── Types ─── */
export interface BankAccount {
  id: string
  bankId: string
  iban: string
  holderName: string
}

interface Props {
  account: BankAccount
  index: number
  onUpdate: (id: string, field: keyof Omit<BankAccount, "id">, value: string) => void
  onRemove: (id: string) => void
  canRemove: boolean
  t: (key: string) => string
  locale: string
}

/* ─── Favicon with initials fallback ─── */
function BankFavicon({ bank, size = 32 }: { bank: SaudiBank; size?: number }) {
  const [err, setErr] = useState(false)
  const px = `${size}px`
  const textSize = size <= 24 ? "text-[9px]" : "text-xs"
  // img inside is smaller than container so rounded-lg on the box clips correctly
  const imgSize = Math.round(size * 0.65)

  if (err) {
    return (
      <div
        className={`rounded-lg ${textSize} font-bold text-white shrink-0 flex items-center justify-center`}
        style={{ width: px, height: px, backgroundColor: bank.color }}
      >
        {bank.initials}
      </div>
    )
  }
  return (
    <div
      className="rounded-lg bg-white border border-border shrink-0 flex items-center justify-center"
      style={{ width: px, height: px }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getBankLogoUrl(bank)}
        alt={bank.nameEn}
        width={imgSize}
        height={imgSize}
        className="object-contain"
        onError={() => setErr(true)}
      />
    </div>
  )
}

/* ─── Bank Account Card ─── */
export function BankAccountCard({ account, onUpdate, onRemove, canRemove, t, locale }: Props) {
  const [ibanFocused, setIbanFocused] = useState(false)
  const [open, setOpen] = useState(false)
  const selectedBank = SAUDI_BANKS.find((b) => b.id === account.bankId)
  const isAr = locale === "ar"

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {selectedBank
            ? <BankFavicon bank={selectedBank} size={36} />
            : (
              <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-surface-muted border border-border shrink-0">
                <HugeiconsIcon icon={Building01Icon} size={18} className="text-muted-foreground" />
              </div>
            )
          }
          <div>
            <p className="text-sm font-medium text-foreground leading-tight">
              {selectedBank
                ? (isAr ? selectedBank.nameAr : selectedBank.nameEn)
                : t("settings.bankTransfer.selectBank")}
            </p>
            {account.iban && (
              <p className="text-xs text-muted-foreground font-numeric mt-0.5" dir="ltr">
                {account.iban.slice(0, 4)}••••••••••••••••••••
              </p>
            )}
          </div>
        </div>
        {canRemove && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-error hover:bg-error/10"
            onClick={() => onRemove(account.id)}
          >
            <HugeiconsIcon icon={Delete02Icon} size={16} />
          </Button>
        )}
      </div>

      {/* ── Bank Selector ── */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t("settings.bankName")}</Label>

        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            {/*
              Fixed layout regardless of page dir:
              [logo] [name ........] [chevron]
              We use explicit flex-row and logical text alignment.
            */}
            <Button
              variant="outline"
              className="w-full h-10 border-border font-normal text-sm flex flex-row items-center gap-2 px-3"
            >
              {/* Logo — always on the start (right in RTL page) */}
              {selectedBank
                ? <BankFavicon bank={selectedBank} size={24} />
                : <div className="h-6 w-6 shrink-0" />
              }

              {/* Name — grows, aligned to page direction */}
              <span className="flex-1 text-start truncate">
                {selectedBank
                  ? (isAr ? selectedBank.nameAr : selectedBank.nameEn)
                  : <span className="text-muted-foreground">{t("settings.bankTransfer.selectBank")}</span>
                }
              </span>

              {/* Chevron — always on the end (left in RTL page) */}
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                size={14}
                className={`text-muted-foreground shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
              />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-72 overflow-hidden p-1"
            align="start"
            sideOffset={4}
          >
            {/* dir on scroll container → scrollbar appears on correct side */}
            <div className="overflow-y-auto max-h-[264px]" dir={isAr ? "rtl" : "ltr"}>
              {SAUDI_BANKS.map((bank) => {
                const isSelected = account.bankId === bank.id
                return (
                  <DropdownMenuItem
                    key={bank.id}
                    dir={isAr ? "rtl" : "ltr"}
                    className="flex items-center gap-3 cursor-pointer rounded-md px-3 py-2.5 data-[highlighted]:bg-surface-muted"
                    onSelect={() => { onUpdate(account.id, "bankId", bank.id); setOpen(false) }}
                  >
                    {/* Logo — logical start (right in RTL) */}
                    <BankFavicon bank={bank} size={28} />

                    {/* Names */}
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm font-medium truncate">
                        {isAr ? bank.nameAr : bank.nameEn}
                      </span>
                      <span className="text-xs text-muted-foreground truncate" dir="ltr">
                        {bank.nameEn}
                      </span>
                    </div>

                    {/* Checkmark — logical end (left in RTL) */}
                    {isSelected && (
                      <HugeiconsIcon icon={Tick01Icon} size={14} className="text-primary shrink-0" />
                    )}
                  </DropdownMenuItem>
                )
              })}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── IBAN ── */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t("settings.bankIban")}</Label>
        <Input
          value={account.iban}
          onChange={(e) => onUpdate(account.id, "iban", e.target.value.toUpperCase())}
          placeholder="SA00 0000 0000 0000 0000 0000"
          className="font-numeric tabular-nums tracking-wider"
          dir="ltr"
          onFocus={() => setIbanFocused(true)}
          onBlur={() => setIbanFocused(false)}
        />
        {ibanFocused && (
          <p className="text-xs text-muted-foreground">{t("settings.bankTransfer.ibanHint")}</p>
        )}
      </div>

      {/* ── Account Holder ── */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t("settings.bankHolder")}</Label>
        <Input
          value={account.holderName}
          onChange={(e) => onUpdate(account.id, "holderName", e.target.value)}
          placeholder={t("settings.bankTransfer.holderPlaceholder")}
        />
      </div>
    </div>
  )
}
