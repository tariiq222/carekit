"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Home01Icon,
  Calendar03Icon,
  UserMultiple02Icon,
  Stethoscope02Icon,
  Settings02Icon,
  AnalyticsUpIcon,
  Add01Icon,
} from "@hugeicons/core-free-icons"

import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandEmpty,
  CommandSeparator,
} from "@/components/ui/command"
import { useLocale } from "@/components/locale-provider"

type CommandEntry = {
  id: string
  labelEn: string
  labelAr: string
  href: string
  icon: typeof Home01Icon
  shortcut?: string
}

const QUICK_ACTIONS: CommandEntry[] = [
  { id: "new-booking", labelEn: "New Booking", labelAr: "حجز جديد", href: "/bookings?new=1", icon: Add01Icon, shortcut: "⌘N" },
  { id: "search-patients", labelEn: "Search Patients", labelAr: "البحث عن مرضى", href: "/patients", icon: UserMultiple02Icon },
  { id: "today-schedule", labelEn: "Today's Schedule", labelAr: "جدول اليوم", href: "/bookings?tab=today", icon: Calendar03Icon },
]

const NAV_COMMANDS: CommandEntry[] = [
  { id: "nav-dashboard", labelEn: "Dashboard", labelAr: "لوحة التحكم", href: "/", icon: Home01Icon },
  { id: "nav-bookings", labelEn: "Bookings", labelAr: "الحجوزات", href: "/bookings", icon: Calendar03Icon },
  { id: "nav-patients", labelEn: "Patients", labelAr: "المرضى", href: "/patients", icon: UserMultiple02Icon },
  { id: "nav-practitioners", labelEn: "Practitioners", labelAr: "الأطباء", href: "/practitioners", icon: Stethoscope02Icon },
  { id: "nav-reports", labelEn: "Reports", labelAr: "التقارير", href: "/reports", icon: AnalyticsUpIcon },
  { id: "nav-settings", labelEn: "Settings", labelAr: "الإعدادات", href: "/settings", icon: Settings02Icon },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { locale } = useLocale()

  const isAr = locale === "ar"
  const quickActionsLabel = isAr ? "إجراءات سريعة" : "Quick Actions"
  const navigateLabel = isAr ? "التنقل" : "Navigate"
  const emptyLabel = isAr ? "لا توجد نتائج." : "No results found."
  const hintLabel = isAr ? "اضغط ↵ للانتقال" : "Press ↵ to navigate"
  const placeholder = isAr ? "ابحث عن أمر..." : "Search commands..."

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [])

  const run = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
    },
    [router],
  )

  const renderItem = (cmd: CommandEntry) => (
    <CommandItem key={cmd.id} value={`${cmd.labelEn} ${cmd.labelAr}`} onSelect={() => run(cmd.href)}>
      <HugeiconsIcon icon={cmd.icon} size={16} className="me-2 shrink-0 text-muted-foreground" />
      <span>{isAr ? cmd.labelAr : cmd.labelEn}</span>
      {cmd.shortcut && <CommandShortcut>{cmd.shortcut}</CommandShortcut>}
    </CommandItem>
  )

  return (
    <CommandDialog open={open} onOpenChange={setOpen} className="max-w-[520px]">
      <CommandInput placeholder={placeholder} />
      <CommandList>
        <CommandEmpty>{emptyLabel}</CommandEmpty>
        <CommandGroup heading={quickActionsLabel}>{QUICK_ACTIONS.map(renderItem)}</CommandGroup>
        <CommandSeparator />
        <CommandGroup heading={navigateLabel}>{NAV_COMMANDS.map(renderItem)}</CommandGroup>
      </CommandList>
      <div className="border-t px-3 py-2 text-xs text-muted-foreground">{hintLabel}</div>
    </CommandDialog>
  )
}
