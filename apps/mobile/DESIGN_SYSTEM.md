# CareKit Mobile — Design System

Source of truth for the "Mental Health Home" visual language. Derived from [`src/theme.ts`](src/theme.ts) + [`src/components/Glass.tsx`](src/components/Glass.tsx). Port to `apps/mobile/theme/` when ready.

---

## 1. Principles

1. **Glass, not plastic** — semi-transparent layered surfaces; never flat white or opaque gray.
2. **Arabic-first** — RTL is not an afterthought; `writingDirection: 'rtl'` + logical-start alignment.
3. **Three tiers of everything** — shape, depth, and translucency each have exactly 3 levels. No free-form values.
4. **Apple-grade motion** — ease-out-quart only; animate `transform` + `opacity` only; no bounce/elastic.
5. **Tokens, not colors** — every visual value lives in `theme.ts`. No inline hex, no ad-hoc shadows.

---

## 2. Color

### Core

| Token | Value | Use |
|---|---|---|
| `deepTeal` | `#154F57` | Primary text, icons, strong accents |
| `softTeal` | `#76B9C4` | Secondary brand accent, fallback gradients |
| `text` | `#154F57` | Body text (alias of deepTeal) |
| `subtle` | `#3E727A` | Secondary text, inactive icons |

### Background wash (top→bottom)

`bgTop #A7DDE5` → `bgUpper #C2E6EC` → `bgMid #D8EEF1` → `bgLower #E8F5F6` → `bgBot #F2F9F9`

Always applied via `LinearGradient` at stops `[0, 0.25, 0.5, 0.72, 1]`. Overlay with `SilkCurves` SVG for texture.

### Glass layer tokens

| Token | Value | Role |
|---|---|---|
| `glass` | `rgba(255,255,255,0.45)` | Default glass tint |
| `glassBrighter` | `rgba(255,255,255,0.60)` | Highlighted glass (rare) |
| `glassBorder` | `rgba(255,255,255,0.55)` | Specular border |
| `ratingGlass` | `rgba(255,255,255,0.85)` | High-read micro pills (rating) |
| `activeTab` | `rgba(255,255,255,0.72)` | Active nav capsule |
| `notifDot` | `#E74C3C` | Unread indicator |

### Semantic accents (Support tints)

Always paired — one light surface tint + one readable icon color:

| Surface tint | Icon color |
|---|---|
| `greenTint rgba(163,205,160,0.42)` | `greenIcon #5A8A56` |
| `peachTint rgba(231,198,160,0.48)` | `peachIcon #C4833F` |
| `tealTint rgba(180,215,218,0.55)` | `tealIcon #4E8E99` |

### Gold (ratings)

| Token | Value | Rule |
|---|---|---|
| `goldFill` | `#FFB300` | **Backgrounds, decorative fills only** (stars as icons, underline swipes) |
| `goldText` | `#8A5A00` | **Every rating number, every gold text** — passes AA on white (5.3:1) |

> Never use `#FFB300` as text. Ever.

---

## 3. Typography

**Font**: `IBM Plex Sans Arabic` — single family for display + body. Don't pair with a Latin family; weights within the family cover hierarchy.

**Scale** (fixed rem-equivalent; no fluid `clamp` in mobile):

| Role | Size | Weight | Line-height | Example |
|---|---|---|---|---|
| Display | 32 | 800 | 42 | Home greeting "مرحباً سارة" |
| Heading | 24 | 800 | 30 | Section titles |
| Subheading | 18 | 700 | 24 | Card titles |
| Body | 14 | 400 | 20 | Default body |
| Caption | 12 | 500 | 16 | Metadata, city names |
| Micro | 11 | 500–700 | 14 | Tab labels, tiny pills |

**Rules**:
- Arabic numerals only in UI (no `toLocaleString` pre-translation).
- All Arabic text: `textAlign: "right"`, `writingDirection: "rtl"`.
- `includeFontPadding: false` on any heading to kill Android top-space.

---

## 4. Shape (radius)

| Token | Value | Use |
|---|---|---|
| `RADII.card` | `22` | All content cards (clinics, therapists, support) |
| `RADII.floating` | `30` | Elevated surfaces (tab bar, hero quick-actions panel) |
| `RADII.image` | `16` | Images nested inside cards |
| `RADII.pill` | `999` | Fully-rounded capsules (search pill, chips) |

Only these four values — no 24, 28, 32 anywhere.

---

## 5. Depth (shadow)

Three tiers, web uses 4-layer stacked shadows for Apple-grade depth; native uses one tuned shadow.

| Token | Role | Web stack |
|---|---|---|
| `SHADOW_SOFT` | Small chips / pills / badges (close to surface) | 2 layers, `rgba(21,79,87, 0.05–0.07)`, max radius 12 |
| `SHADOW` | All content cards (default elevation) | 4 layers, max radius 48, offset 0 10 |
| `SHADOW_RAISED` | Floating bars / hero panels (highest elevation) | 4 layers, max radius 72, offset 0 16 |

**Shadow color is always tinted with `deepTeal`** — never black. Gives a cohesive family feel.

---

## 6. Glass (translucency)

Three variants, each tuned for its depth tier. Always uses the multi-layer `Glass` component — never `backdrop-filter` inline.

| Variant | Blur | Base tint α | Main α | Bloom α | Border α | Typical use |
|---|---|---|---|---|---|---|
| `clear` | 30px | 0.12 | 0.04 | 0.22 | 0.32 | Tiny badges, circular icon spheres |
| `regular` | 50px | 0.20 | 0.06 | 0.32 | 0.40 | Default — all cards, header pills |
| `strong` | 65px | 0.28 | 0.09 | 0.42 | 0.50 | Floating bars, hero panels |

**Glass layer stack** (web, `Glass.tsx`):
1. Base white wash → 2. Main `backdrop-filter blur(Xpx) saturate(180%)` → 3. Inner bloom (blur 3px inset) → 4. Top-biased luminance scatter → 5. Multiply edge shading → 6. Plus-lighter inner highlight → 7. Plus-lighter specular border → 8. Optional color tint.

Light direction is **always top-down** (luminance scatter on top 40%). Never change per surface.

Native uses a single `expo-blur BlurView` with `nativeBlur: 45 / 75 / 95` and the `mainTintAlpha + 0.15` fallback.

### 6.1 Press feedback (Apple Liquid Glass behavior)

When the Glass surface is interactive (`onPress` provided, or external `pressed` flag set), it animates:

- `transform: scale(0.96)` on press-in, back to `scale(1)` on press-out
- `baseTintAlpha += 0.05` while pressed — the surface micro-darkens, matching iOS's "liquid dip"
- Transition: `transform 220ms cubic-bezier(0.2, 0.9, 0.25, 1)` (ease-out-quart)

Consumers have two patterns:

```tsx
// Preferred: Glass owns the Pressable
<Glass onPress={handleTap} interactive variant="regular" radius={RADII.card}>
  <CardContent />
</Glass>

// Fallback: Pressable outside (e.g. when you need render-prop access)
<Pressable onPress={handleTap}>
  {({ pressed }) => (
    <Glass pressed={pressed} interactive variant="regular">
      <CardContent />
    </Glass>
  )}
</Pressable>
```

### 6.2 Accessibility overrides

Glass reads two OS-level accessibility signals via [`src/useA11y.ts`](src/useA11y.ts) and mutates CFG automatically:

| OS setting | Media query / API | Effect on glass |
|---|---|---|
| **Reduce Transparency** | `prefers-reduced-transparency: reduce` (web) / `AccessibilityInfo.isReduceTransparencyEnabled` (native) | `baseTintAlpha → 0.85`, `mainTintAlpha → 0.45`, `bloomAlpha → 0`, `blur → 0`. Surface collapses to a soft-white card. Content behind is fully masked. |
| **Increase Contrast** | `prefers-contrast: more` (web) / `AccessibilityInfo.isHighTextContrastEnabled` (native) | `borderAlpha ×= 1.8` (clamped at 0.95). Edges become unambiguous against any backdrop. |

Both settings are detected once per component instance and re-evaluated when the user toggles them (media-query + native event listeners). No consumer code change needed — every `<Glass>` respects both automatically.

---

## 7. Motion

| Token | Value | Use |
|---|---|---|
| Standard easing | `cubic-bezier(0.2, 0.9, 0.25, 1)` | Hover, press, micro-interactions |
| Stage easing | `cubic-bezier(0.32, 0.72, 0.15, 1)` | Large layout shifts (header search expand) |
| Short duration | `220ms` | Press, hover |
| Medium duration | `360ms` | Staged reveal |

**Animate only** `transform` + `opacity`. Never `width`/`height`/`padding`/`margin` as the PRIMARY animated property. (Layout props may change incidentally, but shouldn't drive the motion.)

Respect `prefers-reduced-motion` → collapse durations to `0ms`.

---

## 8. Spacing

4pt scale. Most common values:

`4, 6, 8, 10, 12, 14, 16, 18, 22, 24, 32`

Use `gap` (not margins) for sibling spacing. Card internal padding is `10`. Rail horizontal padding is `18`. Section outer margin-top is `24–26`.

---

## 9. RTL

- Every `flexDirection: "row"` involving localized content becomes **`row-reverse`**. (See every component in `src/components/*.tsx`.)
- Every `Text` with Arabic content gets `textAlign: "right"` + `writingDirection: "rtl"`.
- Tab bar layout: `row-reverse` so Home tab sits on the RTL-start (right) side.
- Avoid hard-coded `left`/`right` offsets for UI chrome — use `start`/`end`-equivalent logic via `row-reverse`.

---

## 10. Components — canonical patterns

### 10.1 Card (content)

```
Glass variant="regular" radius={RADII.card} style={[..., SHADOW]}
  └ Image/Content
  └ Body (title, meta, Rating)
```

### 10.2 Floating bar (tab bar, hero panel)

```
Glass variant="strong" radius={RADII.floating} style={[..., SHADOW_RAISED]}
```

Positioned absolute (for tab bar) with 14pt safe margin from viewport edges.

### 10.3 Pill / capsule

```
Glass variant="regular" radius={RADII.pill}   // 999 → half-height
  → always fully rounded
  → used for search, icon buttons, rating pills
```

### 10.4 Rating pill

```
View backgroundColor={C.ratingGlass} radius=999
  ├ Ionicon "star" color={C.goldText} size=11–13
  └ Text color={C.deepTeal} weight=700 size=11–12
```

### 10.5 Active tab state (strong orientation)

Three visual signals — all three required:
1. White capsule behind icon (`C.activeTab`, size 40, radius 20)
2. Label becomes bolder and one step larger (`12px, weight 800` vs inactive `11px, weight 500`)
3. Small `4×4` `deepTeal` pip below the label

### 10.6 Image fallback (required)

Every network image in the UI MUST have:
1. A branded gradient background layer always rendered behind the image (`softTeal → deepTeal` diagonal)
2. An `onError` handler that swaps in a recognizable fallback — category icon (clinics) or first letter of the name (therapists) in white at 44–48px.

See [`ClinicsRow.tsx`](src/components/ClinicsRow.tsx) and [`TherapistsRow.tsx`](src/components/TherapistsRow.tsx) for reference implementations.

---

## 11. Accessibility floor

- **Text contrast**: AA (4.5:1) minimum — verified by impeccable detector.
- **Non-text contrast**: 3:1 minimum for meaningful icons.
- **Touch targets**: 44×44 minimum (TabBar active capsule is 40, padded to 44 by the `item` hit area).
- **Active states must never depend on color alone** — always a second signal (capsule + pip, icon fill variant, etc.).

---

## 12. Drop-in TypeScript tokens

Copy into `apps/mobile/theme/glass.ts`:

```typescript
import { Platform } from "react-native";

export const C = {
  deepTeal: "#154F57",
  softTeal: "#76B9C4",
  text: "#154F57",
  subtle: "#3E727A",
  bgTop: "#A7DDE5",
  bgUpper: "#C2E6EC",
  bgMid: "#D8EEF1",
  bgLower: "#E8F5F6",
  bgBot: "#F2F9F9",
  glass: "rgba(255,255,255,0.45)",
  glassBrighter: "rgba(255,255,255,0.6)",
  glassBorder: "rgba(255,255,255,0.55)",
  ratingGlass: "rgba(255,255,255,0.85)",
  activeTab: "rgba(255,255,255,0.72)",
  notifDot: "#E74C3C",
  goldFill: "#FFB300",
  goldText: "#8A5A00",
  greenTint: "rgba(163,205,160,0.42)",
  greenIcon: "#5A8A56",
  peachTint: "rgba(231,198,160,0.48)",
  peachIcon: "#C4833F",
  tealTint: "rgba(180,215,218,0.55)",
  tealIcon: "#4E8E99",
} as const;

export const FONT = '"IBM Plex Sans Arabic"';

export const RADII = {
  card: 22,
  floating: 30,
  image: 16,
  pill: 999,
} as const;

export const EASE = {
  standard: "cubic-bezier(0.2, 0.9, 0.25, 1)",
  stage: "cubic-bezier(0.32, 0.72, 0.15, 1)",
} as const;

export const DURATION = { short: 220, medium: 360 } as const;

// Shadow tiers — tinted with deepTeal, never pure black.
// For full web 4-layer stacks + native elevation values, see
// design-prototype/mental-health-home/src/theme.ts (SHADOW, SHADOW_SOFT, SHADOW_RAISED).

export const GLASS_CFG = {
  clear:   { mainBlur: 30, mainTintAlpha: 0.04, baseTintAlpha: 0.12, bloomAlpha: 0.22, borderAlpha: 0.32, nativeBlur: 45 },
  regular: { mainBlur: 50, mainTintAlpha: 0.06, baseTintAlpha: 0.20, bloomAlpha: 0.32, borderAlpha: 0.40, nativeBlur: 75 },
  strong:  { mainBlur: 65, mainTintAlpha: 0.09, baseTintAlpha: 0.28, bloomAlpha: 0.42, borderAlpha: 0.50, nativeBlur: 95 },
} as const;
```

For the full 4-layer shadow stacks, copy [`SHADOW`, `SHADOW_SOFT`, `SHADOW_RAISED` from `src/theme.ts`](src/theme.ts#L46-L88) verbatim.

For the 8-layer Glass component, copy [`src/components/Glass.tsx`](src/components/Glass.tsx) verbatim — the layer order is load-bearing.

---

## 13. Layout & distribution

### 13.1 Page anatomy (vertical rhythm)

Every screen follows the same vertical cadence. Top to bottom:

```
SafeAreaView (edges: ["top"])
  ScrollView (contentContainerStyle.paddingBottom: 120 to clear floating tab bar)
    Header                  // paddingTop: 6, paddingBottom: 18, paddingHorizontal: 22
    QuickActions            // marginHorizontal: 18, marginTop: 0      (hero, SHADOW_RAISED)
    SectionHeader + Rail    // marginTop: 24, marginBottom: 12 for the header
    SectionHeader + Rail    // repeating, same rhythm
    ...
  TabBar                    // position: absolute, left/right/bottom: 14
Background (behind everything, absoluteFill)
```

**Rules**:
- Exactly one `Header` per screen — always at top.
- Exactly one `TabBar` — floating, 14pt inset from all viewport edges.
- `ScrollView` bottom padding ≥ `TabBar height (74) + bottom inset (14) + breathing (32) = 120`. Never less.
- Never nest a second ScrollView inside a rail's parent ScrollView (web scrolling breaks).

### 13.2 Section rhythm

| Element | Distance |
|---|---|
| Header → QuickActions | 0 (QuickActions sits flush; internal card padding is its top margin) |
| QuickActions → first SectionHeader | `marginTop: 24` on SectionHeader |
| SectionHeader → Rail | `marginBottom: 12` on SectionHeader |
| Rail → Dots (pagination) | `marginTop: -44` on Dots (sits over the rail bottom padding) |
| Dots → next SectionHeader | `marginTop: 26` |

The top-of-next-section distance (26) is 2pt larger than the title-to-content gap (12) — a subtle typographic rhythm where section breaks feel like a breath, section bodies feel connected.

### 13.3 Horizontal rails (ClinicsRow / SupportRow / TherapistsRow)

```
ScrollView horizontal
  contentContainerStyle: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 72,     // space for the inner badge overflow + dots
    gap: 12–14,
    flexDirection: "row-reverse",   // RTL: first item appears on the right
  }
```

| Rail | Card width | Inter-card gap |
|---|---|---|
| Clinics | 180 | 14 |
| Support | 180 | 14 |
| Therapists | 150 | 12 |

**Never** use a FlatList for these short rails (<10 items) — the ScrollView pattern is simpler and avoids virtualization flicker on web.

### 13.4 Safe areas

- Use `SafeAreaProvider` + `SafeAreaView edges={["top"]}` only. Bottom inset is consumed by the floating TabBar's own margin.
- Header prepends `insets.top + 16` only when the design has a colored header band. Pure-glass headers rely on the SafeAreaView top inset alone.
- Desktop web preview (`width > 430 + 40`) renders a `FakeStatusBar` at 42pt to emulate iOS — real devices skip it.

### 13.5 Grid

4pt grid. Every `margin`, `padding`, `gap`, `top`, `bottom`, `left`, `right` value is a multiple of 2 (preferably 4). Permitted values:

`2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 32, 40, 48, 64, 72`

If you need a value not on this list, you're off-grid. Don't do it.

---

## 14. Alignment

### 14.1 The logical-start rule

In RTL the visual "start" (right edge) and the visual "end" (left edge) swap. React Native doesn't give you `marginStart` for free on all platforms, so the prototype uses the one trick that works everywhere:

> **Whenever a container lays out localized children in a row, use `flexDirection: "row-reverse"`.**

That flip maps `flex-start` → visual-right (RTL start) and `flex-end` → visual-left (RTL end). No CSS logical properties required; no `I18nManager.forceRTL` gymnastics.

### 14.2 Text alignment

Every Arabic text element MUST carry:

```tsx
style={{
  textAlign: "right",
  writingDirection: "rtl",
}}
```

Even when the parent is `row-reverse` and you "shouldn't need it" — some text nodes inherit LTR direction from ancestors (web, in particular). Be explicit.

For English text in a localized UI, use:

```tsx
style={{
  textAlign: isRTL ? "right" : "left",
  writingDirection: isRTL ? "rtl" : "ltr",
}}
```

### 14.3 Icon + label pairs

Pattern: icon leads the label visually (icon on the start side).

```tsx
<View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
  <Icon />
  <Text>النص</Text>
</View>
```

- `row-reverse` places the icon on the visual right (RTL start).
- `gap` replaces all margins — never mix `gap` with sibling margins, they compound.

For an LTR locale: swap to `row`. Component code should read from a single source: `flexDirection: isRTL ? "row-reverse" : "row"`.

### 14.4 Cross-axis alignment

| Container | cross-axis target | `alignItems` |
|---|---|---|
| Rows with single-line labels + icon | vertical center | `"center"` |
| Rows with title + meta stacked | baseline-ish | `"flex-start"` on container, push meta to bottom in child |
| Text columns (stacked title + sub) | logical-start aligned | `"flex-end"` in RTL (visual right) |

A text column uses `alignItems: "flex-end"` (RTL) because `flex-end` on the cross-axis in a vertical flex = visual right. This is how `SupportRow`'s content column reads right-aligned without each Text node needing explicit `textAlign`.

### 14.5 Optical alignment

- **Icons in circular capsules** sit at the geometric center of the capsule. Don't offset optically for RTL/LTR — icons are directionless here.
- **Directional icons** (`chevron`, `arrow`) must flip with locale: `transform: [{ scaleX: isRTL ? -1 : 1 }]`.
- **Text + icon pills**: if the pill has a visible border, subtract 1pt from the leading padding to optically balance the border's visual weight.

### 14.6 Self-alignment vs container alignment

Use `alignSelf: "flex-start"` on child Text nodes instead of fighting parent `alignItems`. See `TherapistsRow.body`: the parent sets `alignItems: "flex-start"`, and each Text pins itself with `alignSelf` — so the name, role, and rating pill all hug the visual-right edge cleanly.

### 14.7 Never

- Never use `justifyContent: "flex-start"` as a layout crutch — it does nothing when the parent's main axis auto-sizes.
- Never hard-code `marginLeft` / `marginRight` for directional spacing. Use `gap` on the row, or `marginStart` / `marginEnd` if you absolutely must.
- Never center-align Arabic body paragraphs. Headings can be centered in rare hero moments; body never.

---

## 15. Bilingual — Arabic & English

The app is AR-first but must work in EN. This section makes that explicit.

### 15.1 Direction strategy — the `useDir()` hook

**Do NOT use `I18nManager.forceRTL(true)`** — it requires a full app restart to toggle, and mixed-direction screens (EN app with AR content) break in cryptic ways.

**Do NOT hard-code `flexDirection: "row-reverse"`** — it couples the component to one language. When the locale flips, every row-reverse becomes wrong.

Instead: a `useDir()` hook is the single source of truth for direction-aware primitives. It handles the web/native discrepancy automatically:

- **Web**: sets `document.documentElement.dir` (`rtl` or `ltr`). Browser mirrors flex layout for free — components just use `flexDirection: "row"`.
- **Native**: no CSS direction, so `useDir().row` returns `"row-reverse"` explicitly when `isRTL`.

The hook (reference implementation: [`src/useDir.ts`](src/useDir.ts)):

```tsx
type DirState = {
  locale: "ar" | "en";
  isRTL: boolean;
  row: "row" | "row-reverse";              // use for localized rows
  rowReverse: "row" | "row-reverse";       // rare — opposite of `row`
  alignStart: "flex-start" | "flex-end";   // cross-axis hugging logical start
  alignEnd: "flex-start" | "flex-end";     // cross-axis hugging logical end
  textAlign: "left" | "right";
  writingDirection: "ltr" | "rtl";
  iconScaleX: 1 | -1;                      // for chevrons / arrows
};
```

Every component that has directional layout reads from it:

```tsx
const dir = useDir();
// ...
<View style={{ flexDirection: dir.row, gap: 8 }}>
  <Ionicons name="leaf" />
  <Text style={{ textAlign: dir.textAlign, writingDirection: dir.writingDirection }}>
    {greeting}
  </Text>
</View>
```

**The golden rule**: any localized row writes `flexDirection: dir.row`. Never `"row"` or `"row-reverse"` directly. The one exception is layout chrome that has no localized content (e.g., the `Dots` pagination indicator — justify-center, no logical start/end).

### 15.2 Font stack

One family, both scripts:

```ts
export const FONT = Platform.select({
  web: '"IBM Plex Sans Arabic", "IBM Plex Sans", system-ui, sans-serif',
  default: "IBMPlexSansArabic",  // bundled as an Expo font for native
});
```

IBM Plex Sans Arabic includes matched Latin glyphs — no font-pairing needed. This keeps AR and EN text optically harmonized and removes a whole class of "fallback font" layout jumps.

### 15.3 Type scale per locale

Arabic glyphs render larger and need more line-height. Same physical weight looks heavier in Arabic than Latin.

| Role | AR size | EN size | AR line-height | EN line-height |
|---|---|---|---|---|
| Display | 32 | 32 | 42 | 40 |
| Heading | 24 | 24 | 30 | 28 |
| Subheading | 18 | 18 | 24 | 22 |
| Body | 14 | 14 | 22 | 20 |
| Caption | 12 | 12 | 18 | 16 |

Scale is identical; **only line-height changes** (+2 in AR). Apply via:

```tsx
const lh = (base: number) => (isRTL ? base + 2 : base);
```

For weights: Arabic weight 800 reads as heavy, equivalent to Latin 700. Use weight 800 on AR headings, 700 on EN equivalents — the weight ladder is not linearly portable.

### 15.4 Numerals

- **UI numbers (counts, ratings, prices, times)**: ALWAYS Latin (`0-9`) in both locales. Arabic-Indic numerals (`٠-٩`) are avoided because users scan prices/times faster in Latin regardless of locale.
- **Body-text numerals in a paragraph**: respect the locale — `new Intl.NumberFormat('ar-SA').format(n)` when the number appears inline in AR text. Rare in this app.

### 15.5 Dates & time

```tsx
const locale = isRTL ? "ar-SA" : "en-US";
date.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" });
// → "الخميس، ٢٣ إبريل" / "Thu, Apr 23"
```

- Gregorian calendar only for operational UI (appointments, bookings). Hijri is a display preference, not a default.
- Time uses 12-hour in both locales (`3:30 م` / `3:30 PM`).

### 15.6 Mixed-direction content

Common case: an Arabic label containing a Latin brand name or a number.

```
"موعدك مع د. فيصل في 3:30 م"
```

The embedded Latin text (`3:30 م`) inherits the parent's `writingDirection: "rtl"`, so it renders correctly with bidi algorithm. Do NOT wrap inline Latin in a separate Text node — that forces a segment break and the layout gets jumpy.

Use `U+202A` (LRE) / `U+202C` (PDF) marks only for numbers that would otherwise flip wrong (rare: negative signs, percentages in headlines).

### 15.7 Pluralization

Arabic has 6 plural forms (`zero, one, two, few, many, other`). English has 2. Use ICU message format via `i18next`:

```json
{
  "ar": {
    "appointments": {
      "zero":  "ما عندك مواعيد",
      "one":   "موعد واحد اليوم",
      "two":   "موعدان اليوم",
      "few":   "{{count}} مواعيد اليوم",
      "many":  "{{count}} موعداً اليوم",
      "other": "{{count}} موعد اليوم"
    }
  },
  "en": {
    "appointments": {
      "one":   "1 appointment today",
      "other": "{{count}} appointments today"
    }
  }
}
```

### 15.8 Truncation

- Arabic truncation happens on the LEFT visually (end of the RTL line). iOS and Android handle this correctly when the Text node has `writingDirection: "rtl"`.
- On web, use `direction: rtl` on the parent CSS — `textAlign: "right"` alone is not enough for ellipsis placement.
- `numberOfLines={1}` + `ellipsizeMode="tail"` is the only truncation pattern in this DS.

### 15.9 EN-only screens / AR-only content

Don't mix: a screen is fully AR or fully EN. When the app locale is EN but content is AR (e.g., a therapist's Arabic-only bio), wrap ONLY that content block in an AR-locale context:

```tsx
<View style={{ direction: "rtl" }}>
  <Text style={{ writingDirection: "rtl", textAlign: "right" }}>{arabicBio}</Text>
</View>
```

### 15.10 Image direction

- Logos, avatars, illustrations — never flip.
- UI chrome arrows (`chevron-back`, `chevron-forward`) — always flip with locale via `scaleX: isRTL ? -1 : 1`.
- Lottie animations with directional motion — produce two versions or pick a neutral animation.

---

## 16. Anti-patterns — never ship

- `border-left` / `border-right` colored stripes wider than 1px
- Gradient text (`background-clip: text` + gradient)
- Pure `#000` / `#fff` for large surfaces (always tint toward deepTeal)
- Gold `#FFB300` as text color — always `#8A5A00` for text
- Animating `width` / `height` / `padding` / `margin` as the driver of a transition
- More than one of: 22, 24, 28, 32 as card radius in the same screen
- Dropping the branded gradient fallback behind a network image
- Active tab state conveyed by color alone
