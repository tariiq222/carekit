# Mobile RTL-Native System — Design Spec

**Date:** 2026-04-27
**Scope:** `apps/mobile/` only.
**Out of scope:** `apps/dashboard`, `apps/admin`, `apps/website`, `packages/ui`.

## Background

The Sawaa mobile build is single-tenant and Arabic-only:

- `i18n/index.ts:5,29` sets `DEFAULT_LANGUAGE = 'ar'` and calls `I18nManager.forceRTL(true)`.
- `app/_layout.tsx:56` hard-codes `buildDirState('ar')`.
- There is no language toggle in the UI; `i18n/en.json` is dead weight on this build.
- Per `apps/mobile/CLAUDE.md` and the per-tenant-app strategy, **adding a new tenant means a new build, not a runtime mode**.

Despite the locked locale, the codebase pretends to support a runtime AR↔EN switch via `hooks/useDir.ts` and `theme/rtl.ts`. Every screen calls `useDir()` and threads `dir.textAlign` / `dir.writingDirection` / `dir.row` through ~30+ files. This system is half-applied, leaks bugs through the gaps, and adds boilerplate to every Text and Row.

The visible symptoms (per the user's screenshot of the therapist profile):
- Top-card chevron points `›` (forward) — should be `‹` in RTL.
- Rating row "4.9 (٤١٣ تقييم)" renders awkwardly because mixed Arabic/Latin runs need `writingDirection: 'rtl'` to invoke the platform's bidi algorithm correctly, and that property is set per-call-site rather than as a global default.
- Inconsistent margin/padding directions across screens — some use `marginLeft`, some `marginStart`, some flip via `flexDirection: 'row-reverse'`.

## Goals

- A single, consistent RTL system across `apps/mobile/`.
- The system should be *less* code than today's, not more — by accepting that this build is RTL forever and leaning on React Native's platform-level RTL support.
- Three small primitives (`<Row>`, `<RText>`, `<DirectionalIcon>`) used by default in new screens.
- An ESLint rule that prevents regressions to physical (`marginLeft`, `textAlign: 'left'`, `flexDirection: 'row-reverse'`) styles.
- Zero conditional `isRTL ? ... : ...` ternaries in the mobile codebase after migration.

## Non-Goals

- Web RTL (dashboard/admin/website are out of scope).
- Building a shared `@carekit/rtl` package.
- Supporting English on this mobile build. If a future tenant ships an English mobile app, that's a separate fork (per per-tenant-app strategy) and can re-introduce conditional helpers as it needs them.
- Migrating `i18n/en.json` keys (they stay in place; only the runtime direction system changes).

## Architectural Premise

Once `I18nManager.forceRTL(true)` is set (already done at boot), React Native's layout engine treats:

| Author writes | RN renders visually (RTL build) |
|---|---|
| `flexDirection: 'row'` | row laid out right-to-left (visually `row-reverse`) |
| `marginStart: x` | margin on the right edge |
| `marginEnd: x` | margin on the left edge |
| `paddingStart/End` | padding on right/left respectively |
| `start: x` (absolute pos) | positioned from the right edge |
| `end: x` | positioned from the left edge |

This means **no conditional code is needed** to express RTL layout. The build is always RTL; the platform handles the flip; the developer writes logical edges (`Start`/`End`) and lets the platform decide which physical edge that resolves to.

What does *not* auto-flip:

1. **Hardcoded `textAlign: 'left'` / `'right'`** — these stay literal. We unconditionally use `'right'` (or `'left'` for logical-end alignment) in this build.
2. **Hardcoded `writingDirection: 'ltr'` / `'rtl'`** — needed on every Text node containing Arabic for the platform's bidi algorithm to handle embedded Latin runs correctly.
3. **Directional icon glyphs** — a chevron is just an asset; the platform doesn't know it's directional. Manual mirroring (`scaleX: -1`) required.
4. **Absolute `left:` / `right:`** — these are physical, not logical. RN supports `start:` / `end:` as the logical equivalents.

The system addresses 1–4 via three primitives + a codemod.

## Primitives

### `apps/mobile/components/ui/Row.tsx`

```tsx
import { View, ViewProps, StyleSheet } from 'react-native';

type RowProps = ViewProps & {
  gap?: number;
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'baseline' | 'stretch';
  justifyContent?:
    | 'flex-start' | 'center' | 'flex-end'
    | 'space-between' | 'space-around' | 'space-evenly';
};

export function Row({ style, gap, alignItems = 'center', justifyContent, ...rest }: RowProps) {
  return <View style={[styles.row, { gap, alignItems, justifyContent }, style]} {...rest} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
});
```

Replaces every `<View style={{ flexDirection: 'row' }}>` and every `<View style={{ flexDirection: 'row-reverse' }}>` (the latter is double-flipping under `forceRTL` and was a bug masquerading as a fix).

### `apps/mobile/components/ui/RText.tsx`

```tsx
import { Text, TextProps, StyleSheet } from 'react-native';
import { f400, f500, f600, f700 } from '@/theme/fonts';

type Weight = 'regular' | 'medium' | 'semibold' | 'bold';
type Align = 'start' | 'center' | 'end';

type RTextProps = TextProps & {
  weight?: Weight;
  align?: Align;
};

const fontFor: Record<Weight, () => string> = {
  regular: () => f400(),
  medium: () => f500(),
  semibold: () => f600(),
  bold: () => f700(),
};

const alignStyle: Record<Align, { textAlign: 'right' | 'center' | 'left' }> = {
  start: { textAlign: 'right' },   // logical "start" in this RTL-only build
  center: { textAlign: 'center' },
  end: { textAlign: 'left' },      // logical "end" in this RTL-only build
};

export function RText({ style, weight = 'regular', align = 'start', ...rest }: RTextProps) {
  return (
    <Text
      style={[
        styles.base,
        { fontFamily: fontFor[weight]() },
        alignStyle[align],
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: { writingDirection: 'rtl' },
});
```

`writingDirection: 'rtl'` is unconditional — this fixes the rating-row bidi bug. `align="start"` is the default and resolves to `textAlign: 'right'` in this RTL build.

### `apps/mobile/components/ui/DirectionalIcon.tsx`

```tsx
import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';

type Props = ComponentProps<typeof Ionicons>;

export function DirectionalIcon({ style, ...rest }: Props) {
  return <Ionicons {...rest} style={[{ transform: [{ scaleX: -1 }] }, style]} />;
}
```

Used for chevrons, arrows, and other glyphs whose meaning is directional. Non-directional icons (`heart`, `star`, `bell`, `settings`) keep using `<Ionicons>` directly — there's nothing to flip.

The grep contract is: anywhere `<Ionicons name="chevron-...">`, `name="arrow-back"`, `name="arrow-forward"`, `name="caret-back"`, `name="caret-forward"` — convert to `<DirectionalIcon>`. Heart, bell, star, etc., stay unchanged.

## Style Migration Rules

Six replacements applied repo-wide across `apps/mobile/`:

| Replace | With |
|---|---|
| `marginLeft` (in normal-flow contexts) | `marginStart` (or `marginEnd` if it semantically meant "trailing edge") |
| `marginRight` | `marginEnd` (or `marginStart`) |
| `paddingLeft/Right` | `paddingStart/End` |
| absolute `left:` / `right:` | `start:` / `end:` |
| `flexDirection: 'row-reverse'` | `flexDirection: 'row'` (or `<Row>`) |
| literal `textAlign: 'left'` / `'right'` (in Arabic prose contexts) | `<RText>` defaults, or `align="start"` / `"end"` |

For most call sites the mapping is unambiguous: in code that was authored for an Arabic-only screen, `marginLeft: 8` between an avatar and a name is conceptually "space after the avatar" → `marginEnd: 8`. The codemod handles the trivial cases; ambiguous ones get a `// TODO(rtl): pick start/end` comment and are hand-resolved.

## Removed Surfaces

- `apps/mobile/hooks/useDir.ts` — deleted. ~30 import sites.
- `apps/mobile/theme/rtl.ts` — deleted. Not imported outside `apps/mobile/`.
- `DirContext.Provider` and `buildDirState` usage in `app/_layout.tsx` — removed.
- All `dir.textAlign` / `dir.writingDirection` / `dir.row` style threads — removed in favor of literals or the new primitives.

`I18nManager.forceRTL(true)` in `i18n/index.ts:29` stays — it's the foundation the system relies on.

## Migration Plan

Sequenced phases. Each phase is committed independently so any can be reverted.

### Phase 1 — Add primitives
- Create `components/ui/Row.tsx`, `RText.tsx`, `DirectionalIcon.tsx`.
- No removals yet.
- Manual sanity check: `npm run typecheck`, `npm run dev` boots without errors.

### Phase 2 — Boot simplification
- `app/_layout.tsx`: drop `import { DirContext, buildDirState }`, drop the `<DirContext.Provider>` wrapper, leave the rest intact.
- Delete `hooks/useDir.ts` and `theme/rtl.ts`.
- This will break ~30 files that import `useDir` — Phase 3 fixes them.

### Phase 3 — Codemod sweep
- New script: `apps/mobile/scripts/rtl-codemod.mjs`. Uses `ts-morph` to walk every `.tsx` / `.ts` file under `app/` and `components/` and apply:
  1. Remove `import { useDir } from '@/hooks/useDir'`.
  2. Remove `const dir = useDir();` declarations.
  3. Replace `flexDirection: 'row-reverse'` → `flexDirection: 'row'`.
  4. Replace `flexDirection: dir.row` → `flexDirection: 'row'`.
  5. Replace `textAlign: dir.textAlign` → `textAlign: 'right'`.
  6. Replace `writingDirection: dir.writingDirection` → `writingDirection: 'rtl'`.
  7. Replace `dir.iconScaleX` → `-1` (callers using this are mirroring an icon — convert to `DirectionalIcon` in Phase 5).
  8. Mark unresolvable spots (`dir.alignStart`, `dir.alignEnd`, conditional ternaries on `dir.isRTL`) with `// TODO(rtl)` for hand-fixing.
- Run script, commit the result.

### Phase 4 — Hand-fix the TODOs and physical-margin sweep
- Walk every `// TODO(rtl)` comment, decide `Start` vs `End` based on context.
- Convert `marginLeft`/`Right`, `paddingLeft`/`Right`, absolute `left`/`right` to logical equivalents.
- Replace `<View style={{ flexDirection: 'row', ... }}>` clusters with `<Row>` where it tightens the code (low-priority cosmetic; not required everywhere).

### Phase 5 — Icon migration
- Grep `<Ionicons name="chevron-` and `<Ionicons name="arrow-` and `<Ionicons name="caret-`.
- Replace with `<DirectionalIcon>`.
- Special review: in some contexts (`chevron-down` for an expand toggle) the icon is *not* directional. Hand-check each.

### Phase 6 — ESLint rule
- Add `no-restricted-syntax` rules in `apps/mobile/eslint.config.mjs`:
  - Ban property keys `marginLeft`, `marginRight`, `paddingLeft`, `paddingRight` in style objects.
  - Ban string literal values `'row-reverse'` for `flexDirection`.
  - Ban string literals `'left'` / `'right'` for `textAlign`.
- Ban level: `error`. Exception: `textAlign: 'center'` is allowed (centering is RTL-neutral).

### Phase 7 — Smoke run
- `npm run dev` on iOS sim.
- Walk: welcome → onboarding → register → otp-verify → login → home → therapists → therapist detail → settings → notifications → bookings → chat.
- Verify on each: chevrons mirror, text right-aligned, mixed digits readable, no leftover left-aligned blocks, tab order correct.
- Capture screenshots for the manual-QA report under `docs/superpowers/qa/mobile-rtl-2026-04-27/`.

## File-Level Change Inventory

Files certain to change (~30):

```
apps/mobile/
├── app/_layout.tsx                              MODIFY (drop DirContext)
├── app/(auth)/login.tsx                         MODIFY
├── app/(auth)/register.tsx                      MODIFY
├── app/(auth)/otp-verify.tsx                    MODIFY
├── app/(client)/(tabs)/_layout.tsx              MODIFY
├── app/(client)/(tabs)/home.tsx                 MODIFY
├── app/(client)/(tabs)/profile.tsx              MODIFY
├── app/(client)/(tabs)/notifications.tsx        MODIFY
├── app/(client)/(tabs)/chat.tsx                 MODIFY
├── app/(client)/(tabs)/appointments.tsx         MODIFY
├── app/(client)/(tabs)/records.tsx              MODIFY
├── app/(client)/therapists.tsx                  MODIFY
├── app/(client)/chat.tsx                        MODIFY
├── app/(client)/booking/[serviceId].tsx         MODIFY
├── app/(client)/booking/payment.tsx             MODIFY
├── app/(client)/booking/schedule.tsx            MODIFY
├── app/(client)/booking/confirm.tsx             MODIFY
├── app/(client)/booking/bank-transfer.tsx       MODIFY
├── app/(client)/booking/success.tsx             MODIFY
├── app/(client)/appointment/[id].tsx            MODIFY
├── app/(client)/employee/[id].tsx               MODIFY (← screenshot bug)
├── app/(client)/clinic/[id].tsx                 MODIFY
├── app/(client)/rate/[bookingId].tsx            MODIFY
├── app/(client)/settings-profile-section.tsx    MODIFY
├── components/SectionHeader.tsx                 MODIFY
├── components/SplashWelcome.tsx                 MODIFY
├── components/QuickActions.tsx                  MODIFY
├── components/GlassTabBar.tsx                   MODIFY
├── components/Header.tsx                        MODIFY
├── components/ui/LabeledInput.tsx               MODIFY (drop DirState import)
├── components/features/VideoCallScreen.tsx     MODIFY
├── components/ui/Row.tsx                        NEW
├── components/ui/RText.tsx                      NEW
├── components/ui/DirectionalIcon.tsx            NEW
├── scripts/rtl-codemod.mjs                      NEW
├── eslint.config.mjs                            MODIFY (add restrictions)
├── hooks/useDir.ts                              DELETE
└── theme/rtl.ts                                 DELETE
```

## Tests

### Unit
- `components/ui/__tests__/RText.test.tsx` — renders with `writingDirection: 'rtl'` by default; `align="start"` resolves to `textAlign: 'right'`; `align="end"` resolves to `'left'`.
- `components/ui/__tests__/Row.test.tsx` — renders `flexDirection: 'row'` regardless of props.
- `components/ui/__tests__/DirectionalIcon.test.tsx` — renders Ionicons with `transform: [{ scaleX: -1 }]`.

### Smoke / Manual QA
Plan JSON: `data/kiwi/mobile-rtl-2026-04-27.json`
- 8 most-trafficked screens checked against the visual checklist:
  - Chevrons mirror.
  - All Arabic text right-aligned by default.
  - Mixed-digit lines render correctly (no awkward fragment ordering).
  - Tab bar reads RTL order.
  - Modal close buttons land on the logical-end (visually left) edge.
  - Inputs cursor at the right edge for Arabic, left edge inside the field for embedded Latin (handled by `writingDirection: 'rtl'` on the Text/Input).

### Regression Guard
ESLint rule in Phase 6 prevents the bug class from re-emerging.

## Acceptance Criteria

- All ~30 files importing `useDir` no longer do so.
- `hooks/useDir.ts` and `theme/rtl.ts` are deleted from disk.
- `npm run typecheck` passes in `apps/mobile/`.
- `npm run lint` passes in `apps/mobile/` with the new ESLint rules active.
- `npm run test` in `apps/mobile/` passes (existing suites + new primitive tests).
- Manual smoke run on iOS sim: 8 screens look visually correct under the checklist above; the screenshot bug (top-card chevron in `(client)/employee/[id].tsx`) is fixed.
- Zero `// TODO(rtl)` comments remain in the codebase at end of Phase 4.
- Zero usages of `marginLeft`, `marginRight`, `paddingLeft`, `paddingRight` remain in `apps/mobile/`.
- Zero usages of `flexDirection: 'row-reverse'` remain.
- Zero literal `textAlign: 'left'` or `textAlign: 'right'` outside of `<RText>` and the central `RText` component itself.

## Open Questions

None.
