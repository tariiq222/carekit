/**
 * Color Derivation Utility — CareKit White Label
 *
 * From 2 hex colors (primary + accent), derives all CSS variables
 * needed by the Design System: light shades, ultra-light, foreground,
 * shadows, ring, sidebar variants, etc.
 */

/* ─── Hex ↔ RGB helpers ─── */

interface RGB { r: number; g: number; b: number }

function hexToRgb(hex: string): RGB {
  const clean = hex.replace("#", "")
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  }
}

function rgbToHex({ r, g, b }: RGB): string {
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function rgba({ r, g, b }: RGB, alpha: number): string {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/* ─── HSL helpers ─── */

interface HSL { h: number; s: number; l: number }

export function hexToHsl(hex: string): HSL {
  const { r, g, b } = hexToRgb(hex)
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === rn)      h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
  else if (max === gn) h = ((bn - rn) / d + 2) / 6
  else                 h = ((rn - gn) / d + 4) / 6

  return { h: h * 360, s: Math.max(0, Math.min(1, s)), l: Math.max(0, Math.min(1, l)) }
}

export function hslToHex({ h, s, l }: HSL): string {
  const hn = ((h % 360) + 360) % 360 / 360
  const hue2rgb = (p: number, q: number, t: number) => {
    const tn = t < 0 ? t + 1 : t > 1 ? t - 1 : t
    if (tn < 1 / 6) return p + (q - p) * 6 * tn
    if (tn < 1 / 2) return q
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return rgbToHex({
    r: Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hn) * 255),
    b: Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
  })
}

/**
 * Derive a dark-mode variant of a color.
 * - Forces lightness to targetL for readability on dark backgrounds.
 * - If the color is already light (l > 0.6), reduces saturation by 15%
 *   instead of pushing lightness further (prevents washed-out neon effect).
 */
export function darkVariant(hex: string, targetL = 0.68): string {
  const hsl = hexToHsl(hex)
  if (hsl.l > 0.6) {
    return hslToHex({ ...hsl, s: Math.max(0, hsl.s - 0.15) })
  }
  return hslToHex({ ...hsl, l: targetL })
}

/** Lighten a color by mixing with white */
function lighten(color: RGB, amount: number): RGB {
  return {
    r: color.r + (255 - color.r) * amount,
    g: color.g + (255 - color.g) * amount,
    b: color.b + (255 - color.b) * amount,
  }
}

/** Relative luminance (WCAG) */
function luminance({ r, g, b }: RGB): number {
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  )
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/** Pick white or dark foreground based on contrast */
function contrastForeground(bg: RGB): string {
  return luminance(bg) > 0.4 ? "#1B2026" : "#FFFFFF"
}

/* ─── Derive all CSS variables from 2 colors ─── */

export interface BrandingColors {
  primary:     string        // hex
  accent:      string        // hex
  background?: string | null
  fontFamily?: string | null
  fontUrl?:    string | null
}

export type CSSVarMap = Record<string, string>

export interface DerivedVars {
  light: CSSVarMap
  dark: CSSVarMap
}

export function deriveCssVars({ primary, accent }: BrandingColors): DerivedVars {
  const p = hexToRgb(primary)
  const a = hexToRgb(accent)
  const pLight = lighten(p, 0.15)
  const pFg = contrastForeground(p)
  const aFg = contrastForeground(a)

  // Dark variants
  const darkPrimary = darkVariant(primary, 0.68)
  const darkAccent = darkVariant(accent, 0.62)
  const dp = hexToRgb(darkPrimary)
  const da = hexToRgb(darkAccent)
  const dpFg = contrastForeground(dp)
  const daFg = contrastForeground(da)
  const dpLight = darkVariant(primary, 0.75)

  const light: CSSVarMap = {
    "--primary": primary,
    "--primary-foreground": pFg,
    "--primary-light": rgbToHex(pLight),
    "--primary-ultra-light": rgba(p, 0.08),
    "--accent": accent,
    "--accent-foreground": aFg,
    "--accent-ultra-light": rgba(a, 0.1),
    "--blob-primary": rgba(p, 0.18),
    "--blob-accent": rgba(a, 0.14),
    "--ring": rgba(p, 0.28),
    "--shadow-primary-color": rgba(p, 0.25),
    "--shadow-primary-hover-color": rgba(p, 0.3),
    "--sidebar-primary": primary,
    "--sidebar-primary-foreground": pFg,
    "--sidebar-accent": rgba(p, 0.08),
    "--sidebar-accent-foreground": primary,
    "--sidebar-ring": rgba(p, 0.28),
    "--avatar-1-from": primary,
    "--avatar-1-to": rgbToHex(pLight),
  }

  const dark: CSSVarMap = {
    "--primary": darkPrimary,
    "--primary-foreground": dpFg,
    "--primary-light": dpLight,
    "--primary-ultra-light": rgba(dp, 0.10),
    "--accent": darkAccent,
    "--accent-foreground": daFg,
    "--accent-ultra-light": rgba(da, 0.08),
    "--ring": rgba(dp, 0.35),
    "--shadow-primary-color": rgba(dp, 0.25),
    "--shadow-primary-hover-color": rgba(dp, 0.30),
    "--blob-primary": rgba(dp, 0.14),
    "--blob-accent": rgba(da, 0.10),
    "--sidebar-primary": darkPrimary,
    "--sidebar-primary-foreground": dpFg,
    "--sidebar-accent": rgba(dp, 0.10),
    "--sidebar-accent-foreground": darkPrimary,
    "--sidebar-ring": rgba(dp, 0.35),
  }

  return { light, dark }
}

/** Build inline style object from CSS var map */
export function buildStyleFromVars(vars: CSSVarMap): React.CSSProperties {
  const style: Record<string, string> = {}
  for (const [key, value] of Object.entries(vars)) {
    style[key] = value
  }
  return style as React.CSSProperties
}

/** Validate hex color */
export function isValidHex(color: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(color)
}
