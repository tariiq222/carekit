# Color System — Dark Mode Derivation
**Date:** 2026-03-28
**Scope:** Fix dark mode white-label color system

---

## Problem

`deriveCssVars()` in `dashboard/lib/color-utils.ts` derives light-mode CSS vars only. When dark mode activates, `globals.css` overrides `--primary` and `--accent` with hardcoded lime green (`#9ADB40`) for both — ignoring the client's white-label color entirely. Additionally, `--primary` and `--accent` are identical in dark mode, collapsing visual hierarchy.

---

## Solution Overview

Extend `deriveCssVars()` to derive dark variants automatically from the client's chosen color using HSL lightness manipulation. Inject dark vars via a `<style>` tag targeting `.dark {}`. Clean up hardcoded dark overrides from `globals.css`.

---

## Design

### 1. color-utils.ts — HSL + Dark Derivation

Add HSL conversion helpers and a `darkVariant()` function:

```
hexToHsl(hex: string): { h: number; s: number; l: number }
hslToHex({ h, s, l }): string

darkVariant(hex: string, targetL = 0.68): string
  - Converts hex → HSL
  - Keeps same hue + saturation
  - Forces lightness to targetL (0.68 = readable on dark backgrounds)
  - If original lightness already > 0.6: reduce saturation by 15% instead
    (prevents neon/washed-out result for already-light colors)
```

`deriveCssVars()` returns a new shape:

```typescript
interface DerivedVars {
  light: CSSVarMap   // injected on :root (as before)
  dark: CSSVarMap    // injected inside .dark {} via <style> tag
}
```

Dark vars derived:
- `--primary` → `darkVariant(primary, 0.68)`
- `--primary-foreground` → `contrastForeground(darkPrimary)` (auto white/dark)
- `--primary-light` → `darkVariant(primary, 0.75)`
- `--primary-ultra-light` → `rgba(darkPrimary, 0.10)`
- `--accent` → `darkVariant(accent, 0.62)` (slightly lower than primary to stay distinct)
- `--accent-foreground` → `contrastForeground(darkAccent)`
- `--accent-ultra-light` → `rgba(darkAccent, 0.08)`
- `--ring` → `rgba(darkPrimary, 0.35)`
- `--shadow-primary-color` → `rgba(darkPrimary, 0.25)`
- `--shadow-primary-hover-color` → `rgba(darkPrimary, 0.30)`
- `--blob-primary` → `rgba(darkPrimary, 0.14)`
- `--blob-accent` → `rgba(darkAccent, 0.10)`
- `--sidebar-primary` → darkPrimary hex
- `--sidebar-primary-foreground` → `contrastForeground(darkPrimary)`
- `--sidebar-accent` → `rgba(darkPrimary, 0.10)`
- `--sidebar-accent-foreground` → darkPrimary hex
- `--sidebar-ring` → `rgba(darkPrimary, 0.35)`

**Accent distinctness guarantee:** `darkVariant(accent)` uses `targetL = 0.62` while primary uses `0.68` — ensures they are never identical even if the client picked the same color for both.

### 2. branding-provider.tsx — Dark Injection

Split injection into two functions:

```
injectLightVars(vars: CSSVarMap): void
  - Writes to document.documentElement.style (as before)

injectDarkVars(vars: CSSVarMap): void
  - Finds or creates <style id="carekit-dark-theme"> in document.head
  - Writes: .dark { --primary: ...; --accent: ...; ... }
  - Replacing the element content on each call (no accumulation)

clearVars(lightVars, darkVars): void
  - Removes light vars from documentElement.style
  - Removes #carekit-dark-theme <style> element
```

All three call sites (mount fetch, preview, apply) updated to use both functions.

### 3. globals.css — Remove Hardcoded Dark Overrides

From `.dark {}`, remove these vars (now owned by branding-provider):
- `--primary`, `--primary-foreground`, `--primary-light`, `--primary-ultra-light`
- `--accent`, `--accent-foreground`, `--accent-ultra-light`
- `--ring`
- `--shadow-primary-color`, `--shadow-primary-hover-color`
- `--blob-primary`, `--blob-accent`
- `--sidebar-primary`, `--sidebar-primary-foreground`
- `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-ring`

Remaining in `.dark {}` (untouched):
- Neutrals: `--background`, `--foreground`, `--surface`, `--surface-solid`, `--surface-muted`, `--muted`, `--muted-foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--secondary`, `--secondary-foreground`, `--border`, `--border-strong`, `--input`, `--overlay`
- Semantic states: `--destructive`, `--success`, `--warning`, `--error`, `--info`, `--refunded`
- Charts: `--chart-1` through `--chart-5`
- Sidebar neutrals: `--sidebar`, `--sidebar-foreground`, `--sidebar-border`
- Glass overrides: `--glass-bg`, `--glass-bg-solid`, `--glass-border`
- Avatar gradients, rank colors

### Fallback Behavior

When no white-label config is loaded (API fails or returns null), `globals.css` defaults apply. The `.dark {}` block must still contain safe fallback values for the removed vars — keeping the current lime green as a last-resort default that is only used when the branding API is unreachable.

**Resolution:** Keep the removed vars in `.dark {}` as commented-out fallbacks with a note, OR retain them as actual values but at lower specificity. Since branding-provider injects via `<style>` tag in `<head>`, its specificity wins over `globals.css` — so the fallback values in globals.css serve as the "no branding loaded" state correctly without conflict.

---

## Files Changed

| File | Change |
|------|--------|
| `dashboard/lib/color-utils.ts` | Add HSL helpers + `darkVariant()` + update `deriveCssVars()` return shape |
| `dashboard/components/providers/branding-provider.tsx` | Split inject, add dark injection via `<style>` tag |
| `dashboard/app/globals.css` | Remove 16 hardcoded dark overrides (keep as fallbacks) |

---

## Out of Scope (Next Phase)

- Decorative icon colors (`text-primary` → `text-muted-foreground`) — 13 instances
- Informational badge colors (`bg-primary/10` → `bg-muted`) — 8 instances
- Chart bar tokens (`bg-primary` → `bg-chart-1`) — 4 instances
- Hardcoded hex in forms (`defaultValue: "#354FD8"`) — 7 files

---

## Success Criteria

1. Client picks any color in white-label → dark mode shows a readable lighter variant of that color
2. `--primary` and `--accent` are visually distinct in dark mode even if client picks similar colors
3. No white-label config loaded → dark mode falls back gracefully to current defaults
4. No regression in light mode
5. `color-utils.ts` stays under 350 lines
6. `branding-provider.tsx` stays under 350 lines
