"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react"
import {
  deriveCssVars,
  isValidHex,
  type BrandingColors,
  type CSSVarMap,
} from "@/lib/color-utils"

/* ─── Context ─── */

interface BrandingContextValue {
  /** Current branding colors (null = using defaults from globals.css) */
  colors: BrandingColors | null
  /** Preview colors temporarily without saving */
  preview: (colors: BrandingColors) => void
  /** Clear preview — revert to saved colors */
  clearPreview: () => void
  /** Apply saved branding (after API save) */
  apply: (colors: BrandingColors) => void
}

const BrandingContext = createContext<BrandingContextValue>({
  colors: null,
  preview: () => {},
  clearPreview: () => {},
  apply: () => {},
})

export const useBranding = () => useContext(BrandingContext)

/* ─── CSS var injection ─── */

const DARK_STYLE_ID = "carekit-dark-theme"
const FONT_STYLE_ID = "carekit-font"

function injectLightVars(vars: CSSVarMap) {
  const root = document.documentElement
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value)
  }
}

function injectDarkVars(vars: CSSVarMap) {
  const css = `.dark {\n${Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n")}\n}`

  let el = document.getElementById(DARK_STYLE_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement("style")
    el.id = DARK_STYLE_ID
    document.head.appendChild(el)
  }
  el.textContent = css
}

function injectFont(fontFamily: string | null | undefined, fontUrl: string | null | undefined) {
  const root = document.documentElement
  if (fontFamily) {
    root.style.setProperty("--font-family", fontFamily)
  }
  if (!fontUrl) return
  let el = document.getElementById(FONT_STYLE_ID) as HTMLLinkElement | null
  if (!el) {
    el = document.createElement("link")
    el.id = FONT_STYLE_ID
    el.rel = "stylesheet"
    document.head.appendChild(el)
  }
  el.href = fontUrl
}

function injectBackground(colorBackground: string | null | undefined) {
  if (!colorBackground) return
  document.documentElement.style.setProperty("--background", colorBackground)
}

function _clearAllVars(lightVars: CSSVarMap) {
  const root = document.documentElement
  for (const key of Object.keys(lightVars)) {
    root.style.removeProperty(key)
  }
  document.getElementById(DARK_STYLE_ID)?.remove()
}

/* ─── Apply all branding including extras ─── */

function applyBranding(colors: BrandingColors) {
  const { light, dark } = deriveCssVars(colors)
  injectLightVars(light)
  injectDarkVars(dark)
  injectBackground(colors.background)
  injectFont(colors.fontFamily, colors.fontUrl)
}

/* ─── Fetch public branding (no auth needed) ─── */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5100/api/v1"

let brandingCache: { colors: BrandingColors | null; ts: number } | null = null
const BRANDING_CACHE_TTL = 5 * 60_000

async function fetchBranding(): Promise<BrandingColors | null> {
  if (brandingCache && Date.now() - brandingCache.ts < BRANDING_CACHE_TTL) {
    return brandingCache.colors
  }
  try {
    const res = await fetch(`${API_BASE_URL}/public/branding`)
    if (!res.ok) {
      brandingCache = { colors: null, ts: Date.now() }
      return null
    }
    const body = await res.json()
    const data = body.data ?? body

    const primary = data.colorPrimary ?? data.primaryColor ?? data.primary_color
    const accent = data.colorAccent ?? data.secondaryColor ?? data.secondary_color

    if (!primary || !isValidHex(primary)) {
      brandingCache = { colors: null, ts: Date.now() }
      return null
    }
    const colors: BrandingColors = {
      primary,
      accent:     accent && isValidHex(accent) ? accent : primary,
      background: typeof data.colorBackground === "string" ? data.colorBackground : undefined,
      fontFamily: typeof data.fontFamily === "string" ? data.fontFamily : undefined,
      fontUrl:    typeof data.fontUrl === "string" ? data.fontUrl : undefined,
    }
    brandingCache = { colors, ts: Date.now() }
    return colors
  } catch {
    brandingCache = { colors: null, ts: Date.now() }
    return null
  }
}

/* ─── Provider ─── */

interface Props {
  children: ReactNode
}

export function BrandingProvider({ children }: Props) {
  const [savedColors, setSavedColors] = useState<BrandingColors | null>(null)
  const [previewColors, setPreviewColors] = useState<BrandingColors | null>(null)

  /* Fetch on mount */
  useEffect(() => {
    fetchBranding().then((colors) => {
      if (colors) {
        setSavedColors(colors)
        applyBranding(colors)
      }
    })
  }, [])

  /* Apply active colors (preview takes priority) */
  const activeColors = previewColors ?? savedColors

  useEffect(() => {
    if (!activeColors) return
    applyBranding(activeColors)
  }, [activeColors])

  const preview = useCallback((colors: BrandingColors) => {
    if (isValidHex(colors.primary)) {
      setPreviewColors(colors)
      applyBranding(colors)
    }
  }, [])

  const clearPreview = useCallback(() => {
    setPreviewColors(null)
  }, [])

  const apply = useCallback((colors: BrandingColors) => {
    setSavedColors(colors)
    setPreviewColors(null)
    applyBranding(colors)
  }, [])

  return (
    <BrandingContext.Provider
      value={{ colors: activeColors, preview, clearPreview, apply }}
    >
      {children}
    </BrandingContext.Provider>
  )
}
