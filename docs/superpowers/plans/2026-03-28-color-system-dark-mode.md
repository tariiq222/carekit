# Color System Dark Mode Derivation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix dark mode white-label colors so they derive automatically from the client's chosen color instead of being hardcoded lime green.

**Architecture:** Extend `deriveCssVars()` to return both `light` and `dark` CSSVarMaps using HSL lightness manipulation. The branding provider injects dark vars via a `<style id="deqah-dark-theme">` tag. The hardcoded dark overrides in globals.css are removed — globals.css serves as the no-branding fallback only.

**Tech Stack:** TypeScript, Next.js 15 App Router, CSS custom properties, Jest (existing test runner)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `dashboard/lib/color-utils.ts` | Modify | Add `hexToHsl`, `hslToHex`, `darkVariant`, update `deriveCssVars` return shape |
| `dashboard/lib/__tests__/color-utils.test.ts` | Create | Unit tests for HSL helpers and dark derivation |
| `dashboard/components/providers/branding-provider.tsx` | Modify | Split inject into light/dark, add `<style>` tag injection |
| `dashboard/app/globals.css` | Modify | Remove 16 hardcoded dark overrides from `.dark {}` |

---

## Task 1: Add HSL Helpers to color-utils.ts

**Files:**
- Modify: `dashboard/lib/color-utils.ts`
- Create: `dashboard/lib/__tests__/color-utils.test.ts`

- [ ] **Step 1: Create test file with failing tests for hexToHsl and hslToHex**

```typescript
// dashboard/lib/__tests__/color-utils.test.ts
import { hexToHsl, hslToHex } from "../color-utils"

describe("hexToHsl", () => {
  it("converts pure red", () => {
    const result = hexToHsl("#FF0000")
    expect(result.h).toBeCloseTo(0, 0)
    expect(result.s).toBeCloseTo(1, 2)
    expect(result.l).toBeCloseTo(0.5, 2)
  })

  it("converts Deqah primary blue", () => {
    const result = hexToHsl("#354FD8")
    expect(result.h).toBeCloseTo(230, 0)
    expect(result.s).toBeGreaterThan(0.6)
    expect(result.l).toBeCloseTo(0.52, 1)
  })

  it("converts white", () => {
    const result = hexToHsl("#FFFFFF")
    expect(result.l).toBeCloseTo(1, 2)
  })

  it("converts black", () => {
    const result = hexToHsl("#000000")
    expect(result.l).toBeCloseTo(0, 2)
  })
})

describe("hslToHex", () => {
  it("roundtrips red", () => {
    const hex = hslToHex({ h: 0, s: 1, l: 0.5 })
    expect(hex.toLowerCase()).toBe("#ff0000")
  })

  it("roundtrips white", () => {
    expect(hslToHex({ h: 0, s: 0, l: 1 })).toBe("#ffffff")
  })

  it("roundtrips via hexToHsl", () => {
    const original = "#354FD8"
    const result = hslToHex(hexToHsl(original))
    // allow ±2 per channel due to rounding
    const toNum = (h: string) => parseInt(h.replace("#", ""), 16)
    expect(Math.abs(toNum(result) - toNum(original))).toBeLessThan(0x030303)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd dashboard && npx jest lib/__tests__/color-utils.test.ts --no-coverage 2>&1 | tail -20
```

Expected: `Cannot find module` or `hexToHsl is not a function`

- [ ] **Step 3: Add hexToHsl and hslToHex to color-utils.ts**

Add after the existing `rgba` helper (after line 29 in the current file):

```typescript
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

  return { h: h * 360, s, l }
}

export function hslToHex({ h, s, l }: HSL): string {
  const hn = h / 360
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
```

- [ ] **Step 4: Run tests — confirm hexToHsl + hslToHex pass**

```bash
cd dashboard && npx jest lib/__tests__/color-utils.test.ts --no-coverage 2>&1 | tail -20
```

Expected: all `hexToHsl` and `hslToHex` tests pass.

- [ ] **Step 5: Commit**

```bash
cd dashboard && git add lib/color-utils.ts lib/__tests__/color-utils.test.ts
git commit -m "feat(color-utils): add hexToHsl and hslToHex helpers"
```

---

## Task 2: Add darkVariant() to color-utils.ts

**Files:**
- Modify: `dashboard/lib/color-utils.ts`
- Modify: `dashboard/lib/__tests__/color-utils.test.ts`

- [ ] **Step 1: Add failing tests for darkVariant**

Append to `dashboard/lib/__tests__/color-utils.test.ts`:

```typescript
import { hexToHsl, hslToHex, darkVariant } from "../color-utils"

describe("darkVariant", () => {
  it("makes a dark primary from Deqah blue", () => {
    const result = darkVariant("#354FD8", 0.68)
    const { l } = hexToHsl(result)
    expect(l).toBeCloseTo(0.68, 1)
  })

  it("keeps same hue as original", () => {
    const original = "#354FD8"
    const result = darkVariant(original, 0.68)
    const origH = hexToHsl(original).h
    const resultH = hexToHsl(result).h
    expect(Math.abs(origH - resultH)).toBeLessThan(2)
  })

  it("reduces saturation for already-light colors instead of boosting lightness", () => {
    // #9ADB40 is lime green with l ~0.55 — already light
    const result = darkVariant("#9ADB40", 0.68)
    const { s: origS } = hexToHsl("#9ADB40")
    const { s: resultS } = hexToHsl(result)
    expect(resultS).toBeLessThan(origS)
  })

  it("primary and accent are distinct when same color used for both", () => {
    const primary = darkVariant("#354FD8", 0.68)
    const accent = darkVariant("#354FD8", 0.62)
    expect(primary).not.toBe(accent)
    const { l: lp } = hexToHsl(primary)
    const { l: la } = hexToHsl(accent)
    expect(Math.abs(lp - la)).toBeGreaterThan(0.04)
  })
})
```

- [ ] **Step 2: Run to confirm they fail**

```bash
cd dashboard && npx jest lib/__tests__/color-utils.test.ts --no-coverage 2>&1 | tail -20
```

Expected: `darkVariant is not a function`

- [ ] **Step 3: Add darkVariant() to color-utils.ts**

Add after `hslToHex`:

```typescript
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
```

- [ ] **Step 4: Run tests — all pass**

```bash
cd dashboard && npx jest lib/__tests__/color-utils.test.ts --no-coverage 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd dashboard && git add lib/color-utils.ts lib/__tests__/color-utils.test.ts
git commit -m "feat(color-utils): add darkVariant for HSL lightness manipulation"
```

---

## Task 3: Update deriveCssVars() to Return light + dark

**Files:**
- Modify: `dashboard/lib/color-utils.ts`
- Modify: `dashboard/lib/__tests__/color-utils.test.ts`

- [ ] **Step 1: Add failing tests for new deriveCssVars shape**

Append to `dashboard/lib/__tests__/color-utils.test.ts`:

```typescript
import { deriveCssVars } from "../color-utils"

describe("deriveCssVars", () => {
  const colors = { primary: "#354FD8", accent: "#82CC17" }

  it("returns light and dark maps", () => {
    const result = deriveCssVars(colors)
    expect(result).toHaveProperty("light")
    expect(result).toHaveProperty("dark")
  })

  it("light map has --primary equal to input", () => {
    const { light } = deriveCssVars(colors)
    expect(light["--primary"]).toBe("#354FD8")
  })

  it("dark map has --primary lighter than input", () => {
    const { dark } = deriveCssVars(colors)
    const { l } = hexToHsl(dark["--primary"] as string)
    expect(l).toBeGreaterThan(0.6)
  })

  it("dark primary and dark accent are distinct", () => {
    const { dark } = deriveCssVars(colors)
    expect(dark["--primary"]).not.toBe(dark["--accent"])
  })

  it("dark map contains all required vars", () => {
    const { dark } = deriveCssVars(colors)
    const required = [
      "--primary", "--primary-foreground", "--primary-light",
      "--primary-ultra-light", "--accent", "--accent-foreground",
      "--accent-ultra-light", "--ring", "--shadow-primary-color",
      "--shadow-primary-hover-color", "--blob-primary", "--blob-accent",
      "--sidebar-primary", "--sidebar-primary-foreground",
      "--sidebar-accent", "--sidebar-accent-foreground", "--sidebar-ring",
    ]
    for (const v of required) {
      expect(dark).toHaveProperty(v)
    }
  })
})
```

- [ ] **Step 2: Run to confirm they fail**

```bash
cd dashboard && npx jest lib/__tests__/color-utils.test.ts --no-coverage 2>&1 | tail -20
```

Expected: `result.light is undefined` or similar.

- [ ] **Step 3: Update DerivedVars interface and deriveCssVars()**

Replace the existing `export type CSSVarMap` and `export function deriveCssVars` in `color-utils.ts` with:

```typescript
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
```

- [ ] **Step 4: Run tests — all pass**

```bash
cd dashboard && npx jest lib/__tests__/color-utils.test.ts --no-coverage 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd dashboard && git add lib/color-utils.ts lib/__tests__/color-utils.test.ts
git commit -m "feat(color-utils): deriveCssVars returns light + dark var maps"
```

---

## Task 4: Update branding-provider.tsx to Inject Dark Vars

**Files:**
- Modify: `dashboard/components/providers/branding-provider.tsx`

- [ ] **Step 1: Replace inject/clear helpers and update all call sites**

Replace the entire content of `dashboard/components/providers/branding-provider.tsx` with:

```typescript
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
  buildStyleFromVars,
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

const DARK_STYLE_ID = "deqah-dark-theme"

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

function clearAllVars(lightVars: CSSVarMap) {
  const root = document.documentElement
  for (const key of Object.keys(lightVars)) {
    root.style.removeProperty(key)
  }
  document.getElementById(DARK_STYLE_ID)?.remove()
}

/* ─── Fetch public branding (no auth needed) ─── */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5100/api/v1"

let brandingCache: { colors: BrandingColors | null; ts: number } | null = null
const BRANDING_CACHE_TTL = 5 * 60_000

async function fetchBranding(): Promise<BrandingColors | null> {
  if (brandingCache && Date.now() - brandingCache.ts < BRANDING_CACHE_TTL) {
    return brandingCache.colors
  }
  try {
    const res = await fetch(`${API_BASE}/whitelabel/public`)
    if (!res.ok) {
      brandingCache = { colors: null, ts: Date.now() }
      return null
    }
    const body = await res.json()
    const data = body.data ?? body

    const primary = data.primary_color
    const accent = data.secondary_color

    if (!primary || !isValidHex(primary)) {
      brandingCache = { colors: null, ts: Date.now() }
      return null
    }
    const colors: BrandingColors = {
      primary,
      accent: accent && isValidHex(accent) ? accent : primary,
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
        const { light, dark } = deriveCssVars(colors)
        injectLightVars(light)
        injectDarkVars(dark)
      }
    })
  }, [])

  /* Apply active colors (preview takes priority) */
  const activeColors = previewColors ?? savedColors

  useEffect(() => {
    if (!activeColors) return
    const { light, dark } = deriveCssVars(activeColors)
    injectLightVars(light)
    injectDarkVars(dark)
  }, [activeColors])

  const preview = useCallback((colors: BrandingColors) => {
    if (isValidHex(colors.primary)) {
      setPreviewColors(colors)
      const { light, dark } = deriveCssVars(colors)
      injectLightVars(light)
      injectDarkVars(dark)
    }
  }, [])

  const clearPreview = useCallback(() => {
    setPreviewColors(null)
  }, [])

  const apply = useCallback((colors: BrandingColors) => {
    setSavedColors(colors)
    setPreviewColors(null)
    const { light, dark } = deriveCssVars(colors)
    injectLightVars(light)
    injectDarkVars(dark)
  }, [])

  return (
    <BrandingContext.Provider
      value={{ colors: activeColors, preview, clearPreview, apply }}
    >
      {children}
    </BrandingContext.Provider>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd dashboard && npx tsc --noEmit 2>&1 | grep -E "error|warning" | head -20
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
cd dashboard && git add components/providers/branding-provider.tsx
git commit -m "feat(branding-provider): inject dark vars via style tag"
```

---

## Task 5: Clean Up globals.css Dark Overrides

**Files:**
- Modify: `dashboard/app/globals.css`

- [ ] **Step 1: Remove hardcoded dark brand vars from .dark {}**

In `dashboard/app/globals.css`, find the `.dark {` block (starts at line 194) and remove these 16 lines:

```css
    --primary: #9ADB40;
    --primary-foreground: #1B2026;
    --primary-light: #B0EF60;
    --primary-ultra-light: rgba(154, 219, 64, 0.10);
    --accent: #9ADB40;
    --accent-foreground: #1B2026;
    --accent-ultra-light: rgba(154, 219, 64, 0.08);
    --ring: rgba(154, 219, 64, 0.35);
    --shadow-primary-color: rgba(154, 219, 64, 0.25);
    --shadow-primary-hover-color: rgba(154, 219, 64, 0.3);
    --blob-primary: rgba(154, 219, 64, 0.14);
    --blob-accent: rgba(154, 219, 64, 0.10);
    --sidebar-primary: #9ADB40;
    --sidebar-primary-foreground: #1B2026;
    --sidebar-accent: rgba(154, 219, 64, 0.10);
    --sidebar-accent-foreground: #F1F4F8;
    --sidebar-ring: rgba(107, 127, 232, 0.35);
```

Replace them with a single comment so future devs understand the intent:

```css
    /* Brand vars (--primary, --accent, --ring, --sidebar-primary, etc.)
       are injected dynamically by BrandingProvider via #deqah-dark-theme <style> tag.
       Fallback defaults live in :root above and activate when no branding API is loaded. */
```

- [ ] **Step 2: Verify the dashboard still builds**

```bash
cd dashboard && npm run build 2>&1 | tail -20
```

Expected: build succeeds with no errors.

- [ ] **Step 3: Typecheck**

```bash
cd dashboard && npx tsc --noEmit 2>&1 | grep error | head -20
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
cd dashboard && git add app/globals.css
git commit -m "fix(globals): remove hardcoded dark brand overrides — now derived by BrandingProvider"
```

---

## Task 6: Fix buildStyleFromVars Compatibility

**Files:**
- Modify: `dashboard/lib/color-utils.ts`

`buildStyleFromVars` currently accepts `CSSVarMap`. Any callers passing the old return value of `deriveCssVars` (which was a flat `CSSVarMap`) now get a `DerivedVars` object. Check and fix any call sites.

- [ ] **Step 1: Find all usages of deriveCssVars and buildStyleFromVars**

```bash
cd dashboard && grep -rn "deriveCssVars\|buildStyleFromVars" --include="*.ts" --include="*.tsx" src/ app/ components/ lib/ hooks/ 2>/dev/null || grep -rn "deriveCssVars\|buildStyleFromVars" --include="*.ts" --include="*.tsx" .
```

Note every file and line returned.

- [ ] **Step 2: For each caller of deriveCssVars, update to destructure { light, dark }**

If any file (other than `branding-provider.tsx`) calls `deriveCssVars()` and uses the result directly as a flat map, update it to use `.light`:

```typescript
// Before
const vars = deriveCssVars(colors)
injectVars(vars)

// After
const { light, dark } = deriveCssVars(colors)
injectLightVars(light)
injectDarkVars(dark)
```

If any file calls `buildStyleFromVars(deriveCssVars(colors))`, update to:
```typescript
const { light } = deriveCssVars(colors)
buildStyleFromVars(light)
```

- [ ] **Step 3: Typecheck**

```bash
cd dashboard && npx tsc --noEmit 2>&1 | grep error | head -20
```

Expected: 0 errors.

- [ ] **Step 4: Commit (only if changes were needed)**

```bash
cd dashboard && git add -p
git commit -m "fix(color-utils): update deriveCssVars callers to use light/dark shape"
```

---

## Task 7: Final Verification

- [ ] **Step 1: Run all tests**

```bash
cd dashboard && npx jest --no-coverage 2>&1 | tail -30
```

Expected: all tests pass, 0 failures.

- [ ] **Step 2: Full typecheck**

```bash
cd dashboard && npx tsc --noEmit 2>&1 | grep error
```

Expected: no output (0 errors).

- [ ] **Step 3: Lint**

```bash
cd dashboard && npm run lint 2>&1 | tail -20
```

Expected: 0 errors.

- [ ] **Step 4: Build**

```bash
cd dashboard && npm run build 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 5: Manual smoke test checklist**

Open the dashboard in a browser (`:5001`). Toggle dark mode on/off and verify:

1. Light mode: primary color matches white-label setting
2. Dark mode: primary is a lighter/readable variant of the same hue — NOT lime green
3. Dark mode: accent is visually distinct from primary
4. Dark mode: sidebar active item color is consistent with primary
5. No white-label loaded scenario: toggle dark mode → falls back to globals.css defaults without JS error

- [ ] **Step 6: Commit final verification note**

```bash
git commit --allow-empty -m "chore: color system dark mode derivation complete — verified"
```
