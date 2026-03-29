/**
 * Arabic translations — CareKit Dashboard
 *
 * This file is an index that merges all module translation files.
 * Each module file is kept under 350 lines.
 */

import { arNav } from "./ar.nav"
import { arDashboard } from "./ar.dashboard"
import { arBookings } from "./ar.bookings"
import { arPatients } from "./ar.patients"
import { arPractitioners } from "./ar.practitioners"
import { arServices } from "./ar.services"
import { arFinance } from "./ar.finance"
import { arUsers } from "./ar.users"
import { arSettings } from "./ar.settings"
import { arMisc } from "./ar.misc"
import { arWidget } from "./ar.widget"
import { arIntakeForms } from "./ar.intake-forms"

export const ar: Record<string, string> = {
  ...arNav,
  ...arDashboard,
  ...arBookings,
  ...arPatients,
  ...arPractitioners,
  ...arServices,
  ...arFinance,
  ...arUsers,
  ...arSettings,
  ...arMisc,
  ...arWidget,
  ...arIntakeForms,
}
