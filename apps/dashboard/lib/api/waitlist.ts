/**
 * Waitlist API — CareKit Dashboard
 */

import { api } from "@/lib/api"
import type { WaitlistEntry } from "@/lib/types/waitlist"

interface WaitlistQuery {
  [key: string]: string | number | boolean | undefined
  employeeId?: string
  status?: string
}

/** Admin: list all waitlist entries */
export async function fetchWaitlist(
  query?: WaitlistQuery,
): Promise<WaitlistEntry[]> {
  return api.get<WaitlistEntry[]>(
    "/bookings/waitlist",
    query,
  )
}

/** Admin: remove a waitlist entry */
export async function removeWaitlistEntry(id: string): Promise<void> {
  await api.delete(`/bookings/waitlist/${id}`)
}
