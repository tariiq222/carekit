import { redirect } from "next/navigation"

/**
 * Problem Reports moved to Bookings page (Problem Reports tab).
 * Redirect any old bookmarks/links.
 */
export default function ProblemReportsRedirect() {
  redirect("/bookings?tab=problemReports")
}
