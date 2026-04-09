import {
  Home01Icon,
  Calendar03Icon,
  UserMultiple02Icon,
  Stethoscope02Icon,
  Settings02Icon,
  GridIcon,
  MoneyBag02Icon,
  Invoice02Icon,
  ShieldKeyIcon,
  AnalyticsUpIcon,
  AiChat02Icon,
  Notification03Icon,
  Coupon01Icon,
  Ticket02Icon,
  Building06Icon,
  DocumentValidationIcon,
  PaintBrush01Icon,
} from "@hugeicons/core-free-icons"

export interface NavItem {
  titleKey: string
  href: string
  icon: typeof Home01Icon
  badge?: number
  permission?: string // "module:action" — item hidden if user lacks this permission
}

export interface NavGroup {
  labelKey: string
  items: NavItem[]
}

export const overviewNav: NavItem[] = [
  { titleKey: "nav.dashboard", href: "/", icon: Home01Icon },
]

export const clinicNav: NavItem[] = [
  { titleKey: "nav.bookings", href: "/bookings", icon: Calendar03Icon },
  { titleKey: "nav.patients", href: "/patients", icon: UserMultiple02Icon },
  { titleKey: "nav.practitioners", href: "/practitioners", icon: Stethoscope02Icon },
  { titleKey: "nav.services", href: "/services", icon: GridIcon },
  { titleKey: "nav.branches", href: "/branches", icon: Building06Icon },
  { titleKey: "nav.departments", href: "/departments", icon: Building06Icon, permission: "departments:view" },
  { titleKey: "nav.intakeForms", href: "/intake-forms", icon: DocumentValidationIcon },
]

export const financeNav: NavItem[] = [
  { titleKey: "nav.payments", href: "/payments", icon: MoneyBag02Icon },
  { titleKey: "nav.invoices", href: "/invoices", icon: Invoice02Icon },
  { titleKey: "nav.coupons", href: "/coupons", icon: Coupon01Icon },
  { titleKey: "nav.giftCards", href: "/gift-cards", icon: Ticket02Icon },
  { titleKey: "nav.reports", href: "/reports", icon: AnalyticsUpIcon },
]

export const toolsNav: NavItem[] = [
  { titleKey: "nav.chatbot", href: "/chatbot", icon: AiChat02Icon },
  { titleKey: "nav.notifications", href: "/notifications", icon: Notification03Icon },
]

export const adminNav: NavItem[] = [
  { titleKey: "nav.users", href: "/users", icon: ShieldKeyIcon },
  { titleKey: "nav.whiteLabel", href: "/white-label", icon: PaintBrush01Icon, permission: "whitelabel:edit" },
  { titleKey: "nav.settings", href: "/settings", icon: Settings02Icon },
]

export const navGroups: NavGroup[] = [
  { labelKey: "nav.overview", items: overviewNav },
  { labelKey: "nav.clinic", items: clinicNav },
  { labelKey: "nav.finance", items: financeNav },
  { labelKey: "nav.tools", items: toolsNav },
  { labelKey: "nav.admin", items: adminNav },
]
