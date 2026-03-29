import { redirect } from "next/navigation"

/**
 * ZATCA moved to Invoices page (ZATCA tab).
 * Redirect any old bookmarks/links.
 */
export default function ZatcaRedirect() {
  redirect("/invoices?tab=zatca")
}
