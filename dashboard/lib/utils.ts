import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { CSSProperties } from "react"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns the numeric value only (no symbol).
 * Use <FormattedCurrency> for display with the official SAR symbol.
 * Safely handles null/undefined amounts.
 */
export function formatCurrency(
  amountInHalalat: number | null | undefined,
  _locale: "ar" | "en",
  decimals = 0,
): string {
  if (amountInHalalat == null) return "—"
  return (amountInHalalat / 100).toFixed(decimals)
}

/**
 * Safely joins first and last name, filtering out null/undefined/empty parts.
 * Returns a fallback dash when both are missing.
 */
export function formatName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  fallback = "—",
): string {
  const parts = [firstName, lastName].filter((p) => p?.trim())
  return parts.length > 0 ? parts.join(" ") : fallback
}

/**
 * Safely extracts initials from first and last name.
 * Returns "?" when both are missing or empty.
 */
const AVATAR_PAIRS: [string, string][] = [
  ["var(--avatar-1-from)", "var(--avatar-1-to)"],
  ["var(--avatar-2-from)", "var(--avatar-2-to)"],
  ["var(--avatar-3-from)", "var(--avatar-3-to)"],
  ["var(--avatar-4-from)", "var(--avatar-4-to)"],
  ["var(--avatar-5-from)", "var(--avatar-5-to)"],
  ["var(--avatar-6-from)", "var(--avatar-6-to)"],
  ["var(--avatar-7-from)", "var(--avatar-7-to)"],
  ["var(--avatar-8-from)", "var(--avatar-8-to)"],
]

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  }
  return h
}

/**
 * Returns a deterministic CSS gradient style for an avatar based on an entity id.
 * Uses CSS custom properties so it respects dark mode and white-label theming.
 */
export function getAvatarGradientStyle(id: string): CSSProperties {
  const idx = Math.abs(hashCode(id)) % AVATAR_PAIRS.length
  const [from, to] = AVATAR_PAIRS[idx]
  return { background: `linear-gradient(135deg, ${from}, ${to})` }
}

export function getInitials(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  const f = firstName?.trim()?.[0] ?? ""
  const l = lastName?.trim()?.[0] ?? ""
  return (f + l).toUpperCase() || "?"
}
