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
  StarIcon,
  TaxesIcon,
  Activity01Icon,
} from "@hugeicons/core-free-icons"
import { FeatureKey } from "@deqah/shared/constants"

export interface NavItem {
  titleKey: string
  href: string
  icon: typeof Home01Icon
  badge?: number
  permission?: string // "module:action" — item hidden if user lacks this permission
  featureFlag?: FeatureKey // hide if feature flag is disabled for this org's plan
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
  {
    titleKey: "nav.branches",
    href: "/branches",
    icon: Building06Icon,
    featureFlag: FeatureKey.BRANCHES,
  },
  {
    titleKey: "nav.intakeForms",
    href: "/intake-forms",
    icon: DocumentValidationIcon,
    featureFlag: FeatureKey.INTAKE_FORMS,
  },
  // Ratings is always visible (spec §6.3 — no plan gating)
  { titleKey: "nav.ratings", href: "/ratings", icon: StarIcon },
]

export const financeNav: NavItem[] = [
  { titleKey: "nav.payments", href: "/payments", icon: MoneyBag02Icon },
  { titleKey: "nav.invoices", href: "/invoices", icon: Invoice02Icon },
  {
    titleKey: "nav.coupons",
    href: "/coupons",
    icon: Coupon01Icon,
    featureFlag: FeatureKey.COUPONS,
  },
  {
    titleKey: "nav.reports",
    href: "/reports",
    icon: AnalyticsUpIcon,
    featureFlag: FeatureKey.ADVANCED_REPORTS,
  },
  {
    titleKey: "nav.zatca",
    href: "/zatca",
    icon: TaxesIcon,
    featureFlag: FeatureKey.ZATCA,
  },
]

export const toolsNav: NavItem[] = [
  {
    titleKey: "nav.chatbot",
    href: "/chatbot",
    icon: AiChat02Icon,
    featureFlag: FeatureKey.AI_CHATBOT,
  },
  {
    titleKey: "nav.notifications",
    href: "/notifications",
    icon: Notification03Icon,
  },
  {
    titleKey: "nav.contactMessages",
    href: "/contact-messages",
    icon: Notification03Icon,
  },
  {
    titleKey: "nav.activityLog",
    href: "/activity-log",
    icon: Activity01Icon,
    featureFlag: FeatureKey.ACTIVITY_LOG,
  },
]

export const adminNav: NavItem[] = [
  { titleKey: "nav.users", href: "/users", icon: ShieldKeyIcon },
  {
    titleKey: "nav.branding",
    href: "/branding",
    icon: PaintBrush01Icon,
    permission: "branding:edit",
  },
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
