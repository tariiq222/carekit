/**
 * English translations — CareKit Dashboard
 *
 * This file is an index that merges all module translation files.
 * Each module file is kept under 350 lines.
 */

import { enNav } from "./en.nav"
import { enDashboard } from "./en.dashboard"
import { enBookings } from "./en.bookings"
import { enClients } from "./en.clients"
import { enEmployees } from "./en.employees"
import { enServices } from "./en.services"
import { enFinance } from "./en.finance"
import { enUsers } from "./en.users"
import { enSettings } from "./en.settings"
import { enMisc } from "./en.misc"
import { enIntakeForms } from "./en.intake-forms"
import { enBranding } from "./en.branding"
import { enDepartments } from "./en.departments"
import { enBilling } from "./en.billing"
import { enContent } from "./en.content"
import { enSms } from "./en.sms"
import { enOps } from "./en.ops"
import { enMembers } from "./en.members"

export const en: Record<string, string> = {
  ...enNav,
  ...enDashboard,
  ...enBookings,
  ...enClients,
  ...enEmployees,
  ...enServices,
  ...enFinance,
  ...enUsers,
  ...enSettings,
  ...enMisc,
  ...enIntakeForms,
  ...enBranding,
  ...enDepartments,
  ...enBilling,
  ...enContent,
  ...enSms,
  ...enOps,
  ...enMembers,
}
