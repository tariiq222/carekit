/**
 * English translations — CareKit Dashboard
 *
 * This file is an index that merges all module translation files.
 * Each module file is kept under 350 lines.
 */

import { enNav } from "./en.nav"
import { enDashboard } from "./en.dashboard"
import { enBookings } from "./en.bookings"
import { enPatients } from "./en.patients"
import { enPractitioners } from "./en.practitioners"
import { enServices } from "./en.services"
import { enFinance } from "./en.finance"
import { enUsers } from "./en.users"
import { enSettings } from "./en.settings"
import { enMisc } from "./en.misc"
import { enWidget } from "./en.widget"
import { enIntakeForms } from "./en.intake-forms"
import { enWhiteLabel } from "./en.whitelabel"
import { enGroups } from "./en.groups"
import { enDepartments } from "./en.departments"

export const en: Record<string, string> = {
  ...enNav,
  ...enDashboard,
  ...enBookings,
  ...enPatients,
  ...enPractitioners,
  ...enServices,
  ...enFinance,
  ...enUsers,
  ...enSettings,
  ...enMisc,
  ...enWidget,
  ...enIntakeForms,
  ...enWhiteLabel,
  ...enGroups,
  ...enDepartments,
}
