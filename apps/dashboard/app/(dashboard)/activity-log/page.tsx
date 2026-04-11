import { redirect } from "next/navigation"

/**
 * Activity Log moved to Users & Roles page (Activity Log tab).
 * Redirect any old bookmarks/links.
 */
export default function ActivityLogRedirect() {
  redirect("/users?tab=activityLog")
}
