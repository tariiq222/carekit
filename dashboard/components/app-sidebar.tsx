"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Logout03Icon,
  MedicalMaskIcon,
  Moon02Icon,
  Sun03Icon,
  LanguageSkillIcon,
  CustomerService01Icon,
  Book02Icon,
  UserCircle02Icon,
  LockPasswordIcon,
  PaintBrush01Icon,
} from "@hugeicons/core-free-icons"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import { useLocale } from "@/components/locale-provider"
import { useAuth } from "@/components/providers/auth-provider"
import { ChangePasswordDialog } from "@/components/features/change-password-dialog"
import { cn } from "@/lib/utils"
import { useSidebarNav } from "@/hooks/use-sidebar-nav"

/* ─── Component ─── */

export function AppSidebar() {
  const pathname = usePathname()
  const { t, dir, locale, toggleLocale } = useLocale()
  const { resolvedTheme, setTheme } = useTheme()
  const { logout, user } = useAuth()
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const { isMobile, setOpenMobile } = useSidebar()

  const {
    filteredGroups,
    actionableBookings,
    userInitials,
    userName,
    isItemActive,
    navigate,
    prefetchItem,
  } = useSidebarNav()

  return (
    <>
      <Sidebar collapsible="offcanvas" side={dir === "rtl" ? "right" : "left"} dir={dir}>
        {/* ─── Brand ─── */}
        <SidebarHeader className="px-4 pt-5 pb-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href="/">
                  <div className="flex aspect-square size-10 items-center justify-center rounded-[16px] bg-gradient-to-br from-primary to-primary-light text-primary-foreground shadow-primary">
                    <HugeiconsIcon icon={MedicalMaskIcon} size={20} />
                  </div>
                  <div className="grid flex-1 text-start leading-tight">
                    <span className="truncate text-lg font-bold">{t("app.name")}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {t("app.tagline")}
                    </span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        {/* ─── Navigation ─── */}
        <SidebarContent className="pt-0">
          {filteredGroups.map((group) => (
            <SidebarGroup key={group.labelKey}>
              <SidebarGroupLabel className="!text-[11px] !tracking-[1px]">
                {t(group.labelKey)}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const isActive = isItemActive(item.href)
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onMouseEnter={() => prefetchItem(item.href)}
                          onClick={() => navigate(item.href, isMobile ? () => setOpenMobile(false) : undefined)}
                          className={cn(
                            "cursor-pointer",
                            isActive
                              ? "sidebar-active"
                              : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60",
                          )}
                        >
                          <HugeiconsIcon icon={item.icon} size={18} />
                          <span className="flex-1">{t(item.titleKey)}</span>
                          {item.href === "/bookings" && actionableBookings != null && actionableBookings > 0 && (
                            <span className="flex size-5 items-center justify-center rounded-full text-[11px] font-bold tabular-nums bg-accent text-accent-foreground">
                              {actionableBookings}
                            </span>
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <div className="px-4"><Separator /></div>

        {/* ─── Icon Toolbar ─── */}
        <div className="flex items-center justify-center gap-2 px-4 py-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                aria-label={resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}
                className="toolbar-icon flex size-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
              >
                <HugeiconsIcon icon={resolvedTheme === "dark" ? Sun03Icon : Moon02Icon} size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleLocale}
                aria-label={locale === "en" ? "العربية" : "English"}
                className="toolbar-icon flex size-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
              >
                <HugeiconsIcon icon={LanguageSkillIcon} size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {locale === "en" ? "العربية" : "English"}
            </TooltipContent>
          </Tooltip>

          {(!user?.permissions || user.permissions.includes("whitelabel:view")) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/white-label"
                  aria-label={t("nav.whiteLabel")}
                  className={cn(
                    "toolbar-icon flex size-9 items-center justify-center rounded-full",
                    pathname.startsWith("/white-label")
                      ? "text-primary"
                      : "text-muted-foreground hover:text-primary"
                  )}
                >
                  <HugeiconsIcon icon={PaintBrush01Icon} size={16} />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="top">{t("nav.whiteLabel")}</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                aria-label={t("nav.support")}
                className="toolbar-icon flex size-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
              >
                <HugeiconsIcon icon={CustomerService01Icon} size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{t("nav.support")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                aria-label={t("nav.knowledge")}
                className="toolbar-icon flex size-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
              >
                <HugeiconsIcon icon={Book02Icon} size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{t("nav.knowledge")}</TooltipContent>
          </Tooltip>
        </div>

        <div className="px-4"><Separator /></div>

        {/* ─── Footer — User ─── */}
        <SidebarFooter className="px-4 pt-2 pb-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg" className="toolbar-icon !rounded-[22px] !h-auto !py-2 border border-transparent">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-[16px] bg-gradient-to-br from-primary to-primary-light text-primary-foreground text-xs font-bold">
                      {userInitials}
                    </div>
                    <div className="grid flex-1 text-start text-sm leading-tight">
                      <span className="truncate font-semibold">{userName}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {t("header.role")}
                      </span>
                    </div>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" sideOffset={8} className="w-52 rounded-xl p-1.5">
                  <button
                    onClick={() => {}}
                    className="toolbar-icon flex w-full items-center gap-3 !rounded-xl px-3 py-2.5 text-sm font-medium text-foreground border border-transparent"
                  >
                    <HugeiconsIcon icon={UserCircle02Icon} size={18} className="shrink-0 text-muted-foreground" />
                    {t("header.myProfile")}
                  </button>
                  <button
                    onClick={() => setPasswordOpen(true)}
                    className="toolbar-icon flex w-full items-center gap-3 !rounded-xl px-3 py-2.5 text-sm font-medium text-foreground border border-transparent"
                  >
                    <HugeiconsIcon icon={LockPasswordIcon} size={18} className="shrink-0 text-muted-foreground" />
                    {t("header.changePassword")}
                  </button>
                  <DropdownMenuSeparator className="my-1" />
                  <button
                    onClick={() => setLogoutOpen(true)}
                    className="toolbar-icon flex w-full items-center gap-3 !rounded-xl px-3 py-2.5 text-sm font-medium text-error border border-transparent"
                  >
                    <HugeiconsIcon icon={Logout03Icon} size={18} className="shrink-0" />
                    {t("header.logout")}
                  </button>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />

      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("header.logoutConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("header.logoutConfirmDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={logout}
              className="bg-error text-white hover:bg-error/90"
            >
              {t("header.logoutConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
