"use client"

import { useState, useEffect } from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@carekit/ui"
import { Button } from "@carekit/ui"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Moon02Icon,
  Sun03Icon,
  Notification03Icon,
  Settings02Icon,
  UserCircle02Icon,
  Logout03Icon,
  LockPasswordIcon,
} from "@hugeicons/core-free-icons"
import Link from "next/link"
import { useTheme } from "next-themes"
import { useLocale } from "@/components/locale-provider"
import { useAuth } from "@/components/providers/auth-provider"
import { useUnreadCount } from "@/hooks/use-notifications"
import { ChangePasswordDialog } from "@/components/features/change-password-dialog"
import { cn } from "@/lib/utils"

type FontSize = "S" | "M" | "L"

const fontSizeConfig: Record<FontSize, string> = {
  S: "100%",
  M: "calc(100% + 2px)",
  L: "calc(100% + 4px)",
}

export function Header() {
  const { resolvedTheme, setTheme } = useTheme()
  const { locale, dir, toggleLocale, t } = useLocale()
  const { user, logout } = useAuth()
  const { data: unreadCount } = useUnreadCount()
  const [fontSize, setFontSize] = useState<FontSize>("S")
  const [passwordOpen, setPasswordOpen] = useState(false)

  useEffect(() => {
    document.documentElement.style.fontSize = fontSizeConfig[fontSize]
  }, [fontSize])

  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background/80 backdrop-blur-sm px-3 sm:px-6">
      <SidebarTrigger className="hover:text-primary hover:bg-primary/8" />

      <div className="flex-1" />

      {/* Theme toggle */}
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("header.darkMode")}
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        className="size-9 hover:text-primary hover:bg-primary/8"
      >
        <HugeiconsIcon
          icon={resolvedTheme === "dark" ? Sun03Icon : Moon02Icon}
          size={18}
        />
      </Button>

      {/* Settings */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Settings"
            className="size-9 hover:text-primary hover:bg-primary/8"
          >
            <HugeiconsIcon icon={Settings02Icon} size={18} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={dir === "rtl" ? "start" : "end"}
          className="w-52"
        >
          <div dir={dir}>
            <div className="flex items-center justify-between px-4 py-2">
              <div className="flex items-center gap-2">
                <HugeiconsIcon
                  icon={resolvedTheme === "dark" ? Moon02Icon : Sun03Icon}
                  size={14}
                  className="text-muted-foreground"
                />
                <span className="text-sm text-foreground">
                  {t("header.darkMode")}
                </span>
              </div>
              <Switch
                size="sm"
                checked={resolvedTheme === "dark"}
                onCheckedChange={(checked) =>
                  setTheme(checked ? "dark" : "light")
                }
              />
            </div>
            <DropdownMenuSeparator />
            <button
              onClick={toggleLocale}
              className="flex w-full items-center justify-between px-4 py-2 text-sm text-foreground hover:bg-primary/8 transition-all duration-200 rounded-sm"
            >
              <span>{t("header.language")}</span>
              <span className="text-xs font-medium text-primary">
                {locale === "en" ? "العربية" : "English"}
              </span>
            </button>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground px-4">
              {t("header.fontSize")}
            </DropdownMenuLabel>
            <div className="flex gap-2 px-4 pb-2 pt-2">
              {(["S", "M", "L"] as FontSize[]).map((size) => (
                <button
                  key={size}
                  onClick={() => setFontSize(size)}
                  className={cn(
                    "flex-1 rounded-md py-2 text-xs font-semibold transition-all duration-200",
                    fontSize === size
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-surface-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Notifications */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Notifications"
            data-testid="notifications-bell"
            className="relative size-9 hover:text-primary hover:bg-primary/8"
          >
            <HugeiconsIcon icon={Notification03Icon} size={18} />
            {(unreadCount ?? 0) > 0 && (
              <span
                data-testid="notifications-badge"
                className="absolute -top-0.5 -end-0.5 flex size-4 items-center justify-center rounded-full bg-error text-[9px] font-bold tabular-nums text-white ring-2 ring-background"
              >
                {unreadCount! > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={dir === "rtl" ? "start" : "end"} className="w-72">
          <div dir={dir}>
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {t("notifications.title")}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="px-2 py-3 text-center text-xs text-muted-foreground">
              {(unreadCount ?? 0) > 0
                ? `${unreadCount} ${t("notifications.unread")}`
                : t("notifications.empty.description")}
            </div>
            <DropdownMenuSeparator />
            <Link
              href="/notifications"
              className="flex items-center justify-center rounded-sm px-4 py-2 text-sm font-medium text-primary hover:bg-primary/8 transition-all duration-200"
            >
              {t("notifications.viewAll")}
            </Link>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="h-6" />

      {/* User profile */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-all duration-200 hover:bg-primary/8">
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                {(() => {
                  if (!user) return "—"
                  const parts = user.name?.trim().split(/\s+/).filter(Boolean) ?? []
                  const initials = parts.slice(0, 2).map((p) => p[0]).join("").toUpperCase()
                  if (initials) return initials
                  return user.email?.[0]?.toUpperCase() ?? "—"
                })()}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:grid text-start text-sm leading-tight">
              <span className="font-semibold text-foreground text-xs">
                {user ? user.name || user.email || "—" : "—"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {t("header.role")}
              </span>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={dir === "rtl" ? "start" : "end"}
          className="w-48"
        >
          <div dir={dir}>
            <button
              onClick={() => {}}
              className="flex w-full items-center gap-2.5 rounded-sm px-4 py-2 text-sm text-foreground hover:bg-primary/8 transition-all duration-200"
            >
              <HugeiconsIcon icon={UserCircle02Icon} size={16} className="text-muted-foreground" />
              {t("header.myProfile")}
            </button>
            <button
              onClick={() => setPasswordOpen(true)}
              className="flex w-full items-center gap-2.5 rounded-sm px-4 py-2 text-sm text-foreground hover:bg-primary/8 transition-all duration-200"
            >
              <HugeiconsIcon icon={LockPasswordIcon} size={16} className="text-muted-foreground" />
              {t("header.changePassword")}
            </button>
            <DropdownMenuSeparator />
            <button
              onClick={logout}
              className="flex w-full items-center gap-2.5 rounded-sm px-4 py-2 text-sm text-error hover:bg-error/8 transition-all duration-200"
            >
              <HugeiconsIcon icon={Logout03Icon} size={16} />
              {t("header.logout")}
            </button>
          </div>
        </DropdownMenuContent>

      </DropdownMenu>

      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </header>
  )
}
