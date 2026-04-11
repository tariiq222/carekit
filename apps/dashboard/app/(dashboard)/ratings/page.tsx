import { redirect } from "next/navigation"

/**
 * Ratings moved to Practitioners page (Ratings tab).
 * Redirect any old bookmarks/links.
 */
export default function RatingsRedirect() {
  redirect("/practitioners?tab=ratings")
}
