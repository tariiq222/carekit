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
  Building06Icon,
  DocumentValidationIcon,
  PaintBrush01Icon,
} from "@hugeicons/core-free-icons"
import type { FeatureFlagKey } from "@carekit/shared/constants"

export interface NavItem {
  titleKey: string
  href: string
  icon: typeof Home01Icon
  badge?: number
  permission?: string // "module:action" — item hidden if user lacks this permission
  featureFlag?: FeatureFlagKey // hide if feature flag is disabled
}

export interface NavGroup {
  labelKey: string
  items: NavItem[]
}

export const overviewNav: NavItem[] = [
  { titleKey: "nav.dashboard", href: "/", icon: Home01Icon },
]

export const organizationNav: NavItem[] = [
  { titleKey: "nav.bookings", href: "/bookings", icon: Calendar03Icon },
  { titleKey: "nav.clients", href: "/clients", icon: UserMultiple02Icon },
  { titleKey: "nav.employees", href: "/employees", icon: Stethoscope02Icon },
  { titleKey: "nav.services", href: "/services", icon: GridIcon },
  { titleKey: "nav.categories", href: "/categories", icon: GridIcon },
  { titleKey: "nav.departments", href: "/departments", icon: Building06Icon },
  { titleKey: "nav.branches", href: "/branches", icon: Building06Icon, featureFlag: "multi_branch" },
  { titleKey: "nav.intakeForms", href: "/intake-forms", icon: DocumentValidationIcon, featureFlag: "intake_forms" },
]

export const financeNav: NavItem[] = [
  { titleKey: "nav.payments", href: "/payments", icon: MoneyBag02Icon },
  { titleKey: "nav.invoices", href: "/invoices", icon: Invoice02Icon },
  { titleKey: "nav.coupons", href: "/coupons", icon: Coupon01Icon, featureFlag: "coupons" },
  { titleKey: "nav.reports", href: "/reports", icon: AnalyticsUpIcon, featureFlag: "reports" },
]

export const toolsNav: NavItem[] = [
  { titleKey: "nav.chatbot", href: "/chatbot", icon: AiChat02Icon, featureFlag: "chatbot" },
  { titleKey: "nav.notifications", href: "/notifications", icon: Notification03Icon },
  { titleKey: "nav.contactMessages", href: "/contact-messages", icon: Notification03Icon },
]

export const adminNav: NavItem[] = [
  { titleKey: "nav.users", href: "/users", icon: ShieldKeyIcon },
  { titleKey: "nav.branding", href: "/branding", icon: PaintBrush01Icon, permission: "branding:edit" },
  { titleKey: "nav.content", href: "/content", icon: DocumentValidationIcon },
  { titleKey: "nav.settings", href: "/settings", icon: Settings02Icon },
]

export const navGroups: NavGroup[] = [
  { labelKey: "nav.overview", items: overviewNav },
  { labelKey: "nav.organization", items: organizationNav },
  { labelKey: "nav.finance", items: financeNav },
  { labelKey: "nav.tools", items: toolsNav },
  { labelKey: "nav.admin", items: adminNav },
]
