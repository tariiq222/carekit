# CareKit Mobile UX Audit — P0 & P1 Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all P0 blockers (design system duplication, OTP autofill, chat nav trap, employee status labels) and P1 improvements (dark mode, progress lies, 7-day limit, placeholder names, timezones), restoring CareKit mobile to a cohesive, accessible, performant iOS-quality app.

**Architecture:**
- **Phase 1 (P0s, 2–3 days):** Parallel fixes to OTP autofill, chat nav, and employee status labels (independent); these unblock QA.
- **Phase 2 (Design System, 5 days):** Unify Sawaa Glass across all 15 screens (the structural blocker); consolidate 43 hardcoded hex into tokens; delete Themed* system.
- **Phase 3 (P1 UX, 3–4 days):** Booking flow (7-day → calendar, progress indicator, placeholder name, timezone); dark mode toggle; form errors.
- **Phase 4 (P1 Performance & A11y, 2 days):** ScrollView → FlatList, animation tuning, a11y annotations, reduce-motion support.

**Tech Stack:** React Native 0.83, Expo 55, TanStack Query v5, Tailwind Expo, react-native-calendars, accessible-helpers.

---

## File Structure Map

### Theme System (Design System Unification)

**Files to delete** (after migration):
- `apps/mobile/theme/components/ThemedButton.tsx`
- `apps/mobile/theme/components/ThemedCard.tsx`
- `apps/mobile/theme/components/ThemedText.tsx`
- `apps/mobile/theme/context/ThemeContext.tsx`

**Files to expand** (consolidate Themed logic):
- `apps/mobile/theme/sawaa/colors.ts` — add primary/secondary/accent tokens, remove hardcoded #1D4ED8
- `apps/mobile/theme/sawaa/components.ts` — unified button/card/text components (export as `SawaaButton`, `SawaaCard`, `SawaaText`)

**Files to migrate** (Themed → Sawaa, 15 screens):
- Auth flow: `(auth)/welcome.tsx`, `(auth)/login.tsx`, `(auth)/register.tsx`, `(auth)/forgot-password.tsx`, `(auth)/otp-verify.tsx`, `(auth)/reset-password.tsx` (6)
- Employee tabs: `(employee)/(tabs)/today.tsx`, `(employee)/(tabs)/calendar.tsx`, `(employee)/(tabs)/clients.tsx`, `(employee)/(tabs)/profile.tsx` (4)
- Settings: `(client)/settings.tsx` (1)
- OTP landing: `(auth)/otp-landing.tsx` (1)
- Shared modals: `components/shared/` modals using Themed* (3)

### OTP Autofill (P0-2)

**Files:**
- Modify: `(auth)/otp-verify.tsx:226-249` — add textContentType, auto-submit logic
- Modify: `(auth)/reset-password.tsx` — same as above
- Test: `apps/mobile/app/(auth)/__tests__/otp-verify.test.tsx` (new)

### Chat Navigation (P0-3)

**Files:**
- Modify: `(client)/(tabs)/_layout.tsx:41` — remove HIDDEN_ON set or replace with modal nav
- Modify: `(client)/(tabs)/chat.tsx` — add close button if modal

### Employee Status Labels (P0-4)

**Files:**
- Modify: `(employee)/(tabs)/today.tsx:159-160` — fix status mapping
- Modify: `(employee)/(tabs)/calendar.tsx:86` — fix label render
- Test: `apps/mobile/__tests__/employee-status-labels.test.ts` (new)

### Booking Flow (P1-3, P1-4, P1-5, P1-7)

**Files:**
- Modify: `booking/schedule.tsx:46-56, 197` — 7-day → calendar, remove hardcoded timezone
- Modify: `(tabs)/home.tsx:29, 77` — remove placeholder name, time-aware greeting
- Modify: `booking/confirm.tsx:70-75, 19` — remove VAT hardcode, fetch service by ID
- Modify: `booking/payment.tsx:167` — fix layout shift on border change
- Test: `booking/__tests__/schedule.test.ts` (new)

### Dark Mode Toggle (P1-1)

**Files:**
- Modify: `(client)/settings.tsx:178-186` — remove fake toggle or implement dark mode
- Modify: `theme/sawaa/components.ts` — add dark variants (optional, likely defer to P2)

### Progress Indicator (P1-2)

**Files:**
- Modify: `booking/[serviceId].tsx`, `booking/schedule.tsx`, `booking/confirm.tsx`, `booking/payment.tsx` — update step counts 3 of 3 → 4 of 4, show progress in payment

### Other P1s (TanStack, ScrollView, animations, a11y)

**Files:**
- Modify: `(employee)/(tabs)/today.tsx:54-63` — use useEmployeeTodayBookings hook
- Modify: `appointments.tsx`, `notifications.tsx`, `chat.tsx` — ScrollView → FlatList
- Modify: `(tabs)/home.tsx` — reduce animation stagger delays
- Add: a11y annotations across 15 screens

---

## Execution Phases

### Phase 1: P0 Quick Wins (2–3 days, parallelizable)

These are independent of design system work and unblock QA immediately.

#### Task 1: OTP Autofill (P0-2)

**Files:**
- Modify: `apps/mobile/app/(auth)/otp-verify.tsx:226-249`
- Modify: `apps/mobile/app/(auth)/reset-password.tsx`
- Test: `apps/mobile/app/(auth)/__tests__/otp-verify.test.tsx`

- [ ] **Step 1: Inspect current OTP implementation**

Read `apps/mobile/app/(auth)/otp-verify.tsx` to understand structure (6 separate TextInput components, refs, focus logic).

- [ ] **Step 2: Write test for autofill support**

Create `apps/mobile/app/(auth)/__tests__/otp-verify.test.tsx`:

```typescript
import { render } from '@testing-library/react-native';
import OtpVerify from '../otp-verify';

describe('OtpVerify', () => {
  it('should have textContentType="oneTimeCode" on all OTP inputs', () => {
    const { UNSAFE_getByType } = render(<OtpVerify />);
    const textInputs = UNSAFE_getByType(TextInput);

    textInputs.forEach((input) => {
      expect(input.props.textContentType).toBe('oneTimeCode');
    });
  });

  it('should auto-submit when all 6 digits are filled', async () => {
    const { getByTestId } = render(<OtpVerify />);
    const handleVerify = jest.fn();

    // Simulate filling all 6 boxes
    const inputs = [0, 1, 2, 3, 4, 5].map(i => getByTestId(`otp-input-${i}`));
    inputs.forEach((input, i) => {
      fireEvent.changeText(input, String(i % 10));
    });

    await waitFor(() => {
      expect(handleVerify).toHaveBeenCalled();
    });
  });
});
```

Run: `npm run test -- otp-verify.test.ts`
Expected: FAIL (tests don't exist yet)

- [ ] **Step 3: Update OTP input components with autofill**

Modify `apps/mobile/app/(auth)/otp-verify.tsx` (around line 226):

Find this section:
```typescript
<TextInput
  ref={otpRef1}
  value={otp[0]}
  onChangeText={(text) => handleOtpChange(text, 0)}
  keyboardType="number-pad"
  maxLength={1}
  // ... other props
/>
```

Replace with:
```typescript
<TextInput
  ref={otpRef1}
  value={otp[0]}
  onChangeText={(text) => {
    handleOtpChange(text, 0);
    // Auto-submit if all 6 filled
    if (text && otp[1] && otp[2] && otp[3] && otp[4] && otp[5]) {
      handleVerify();
    }
  }}
  keyboardType="number-pad"
  maxLength={1}
  textContentType="oneTimeCode"
  autoComplete="sms-otp"
  accessibilityLabel={t('otp.box', { number: 1, total: 6 })}
  testID="otp-input-0"
  // ... other props
/>
```

Repeat for all 6 inputs (refs otpRef1–otpRef6), updating the logic to check the corresponding indices and auto-submit when all filled.

- [ ] **Step 4: Do the same for reset-password OTP**

Modify `apps/mobile/app/(auth)/reset-password.tsx` — apply identical changes to any OTP input fields on this screen.

- [ ] **Step 5: Run tests**

Run: `npm run test -- otp-verify.test.ts`
Expected: PASS

- [ ] **Step 6: Manual QA — iOS SMS autofill**

1. Deploy to iOS simulator or device
2. Trigger OTP verification
3. Paste SMS code → should auto-fill the 6 boxes
4. All boxes filled → should auto-submit (no manual tap)

Verify in both light + dark mode (or theme that exists).

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/app/\(auth\)/{otp-verify,reset-password}.tsx apps/mobile/app/\(auth\)/__tests__/otp-verify.test.tsx
git commit -m "feat(mobile): add SMS OTP autofill (oneTimeCode) + auto-submit on complete"
```

---

#### Task 2: Fix Chat Navigation Trap (P0-3)

**Files:**
- Modify: `apps/mobile/app/(client)/(tabs)/_layout.tsx:41`
- Modify: `apps/mobile/app/(client)/(tabs)/chat.tsx`

- [ ] **Step 1: Understand HIDDEN_ON pattern**

Read `apps/mobile/app/(client)/(tabs)/_layout.tsx` — find `HIDDEN_ON = new Set(['chat'])` and understand why chat hides the bottom nav.

- [ ] **Step 2: Decide: keep nav visible or modal?**

**Option A (Recommended):** Keep nav visible, reduce opacity on chat screen:
- Add `opacity: 0.7` to nav when route is 'chat'
- Add clear "back to home" swipe hint

**Option B:** Replace chat with modal:
- Change chat from tab to modal in nav structure
- Add explicit "X" close button

Assumption: We choose **Option A** (less disruptive, matches iOS patterns).

- [ ] **Step 3: Remove HIDDEN_ON condition**

In `apps/mobile/app/(client)/(tabs)/_layout.tsx`, find and remove:
```typescript
const HIDDEN_ON = new Set(['chat']);
```

And remove the conditional that hides the nav:
```typescript
if (HIDDEN_ON.has(state.routes[state.index].name)) {
  // Hide nav
}
```

Replace with a reduced-opacity style when on chat:
```typescript
const isChatActive = state.routes[state.index]?.name === 'chat';
<TabBar
  style={[
    styles.tabBar,
    isChatActive && { opacity: 0.7 }
  ]}
  // ...
/>
```

- [ ] **Step 4: Update chat screen to hint swipe-back**

In `apps/mobile/app/(client)/(tabs)/chat.tsx`, add a visual hint at the top:
```typescript
<View style={{ paddingVertical: 8, paddingHorizontal: 16 }}>
  <Text style={{ fontSize: 12, color: colors.muted, textAlign: 'center' }}>
    {t('swipeToGoBack')} ←
  </Text>
</View>
```

(Add translation key `swipeToGoBack` to i18n.)

- [ ] **Step 5: Run app and test navigation**

1. Open app as client
2. Go to Chat tab
3. Verify bottom nav is still visible (muted)
4. Swipe back or tap another tab → should work
5. Return to chat → nav opacity returns to 1

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/\(client\)/\(tabs\)/{_layout.tsx,chat.tsx}
git commit -m "fix(mobile): remove chat nav trap, keep tabs visible with hint"
```

---

#### Task 3: Fix Employee Status Labels (P0-4)

**Files:**
- Modify: `apps/mobile/app/(employee)/(tabs)/today.tsx:159-160`
- Modify: `apps/mobile/app/(employee)/(tabs)/calendar.tsx:86`
- Test: `apps/mobile/__tests__/employee-status-labels.test.ts`

- [ ] **Step 1: Write test for status mapping**

Create `apps/mobile/__tests__/employee-status-labels.test.ts`:

```typescript
import { getStatusLabel } from '../lib/status-helpers';

describe('Employee Status Labels', () => {
  it('should map all BookingStatus values to correct labels', () => {
    const statuses = {
      pending: 'appointments.pending',
      confirmed: 'appointments.confirmed',
      completed: 'appointments.completed',
      cancelled: 'appointments.cancelled',
      no_show: 'appointments.no_show',
      expired: 'appointments.expired',
    };

    Object.entries(statuses).forEach(([status, expectedKey]) => {
      expect(getStatusLabel(status)).toBe(expectedKey);
    });
  });

  it('should never return "completed" for cancelled or no_show', () => {
    expect(getStatusLabel('cancelled')).not.toBe('appointments.completed');
    expect(getStatusLabel('no_show')).not.toBe('appointments.completed');
  });
});
```

Run: `npm run test -- employee-status-labels.test.ts`
Expected: FAIL (helper doesn't exist)

- [ ] **Step 2: Create status helper**

Create `apps/mobile/lib/status-helpers.ts`:

```typescript
import type { BookingStatus } from '@carekit/shared';

const STATUS_LABEL_MAP: Record<BookingStatus, string> = {
  pending: 'appointments.pending',
  confirmed: 'appointments.confirmed',
  completed: 'appointments.completed',
  cancelled: 'appointments.cancelled',
  no_show: 'appointments.no_show',
  expired: 'appointments.expired',
};

export function getStatusLabel(status: BookingStatus): string {
  return STATUS_LABEL_MAP[status];
}
```

- [ ] **Step 3: Run test**

Run: `npm run test -- employee-status-labels.test.ts`
Expected: PASS

- [ ] **Step 4: Update today.tsx**

In `apps/mobile/app/(employee)/(tabs)/today.tsx`, find the status rendering (around line 159):

```typescript
const TYPE_COLOR = status === 'confirmed' ? 'confirmed' : 'completed';
```

Replace with:
```typescript
import { getStatusLabel } from '@/lib/status-helpers';

// ... in render
<StatusPill
  status={item.status}
  label={t(getStatusLabel(item.status))}
/>
```

- [ ] **Step 5: Update calendar.tsx**

In `apps/mobile/app/(employee)/(tabs)/calendar.tsx`, find the label render (around line 86):

```typescript
label={t('appointments.confirmed')}  // ← hardcoded, WRONG
```

Replace with:
```typescript
import { getStatusLabel } from '@/lib/status-helpers';

// ... in render
label={t(getStatusLabel(item.status))}
```

- [ ] **Step 6: Manual QA**

1. As employee, navigate to Today tab
2. View a booking with status 'cancelled' → should show "ملغى" (AR) or "Cancelled" (EN)
3. View a booking with status 'completed' → should show "مكتملة" (AR) or "Completed" (EN)
4. Repeat on Calendar tab
5. Verify colors match status (red for cancelled, green for completed, etc.)

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/lib/status-helpers.ts apps/mobile/app/\(employee\)/\(tabs\)/{today,calendar}.tsx apps/mobile/__tests__/employee-status-labels.test.ts
git commit -m "fix(mobile): correct employee booking status labels (cancelled, no_show, expired)"
```

---

### Phase 2: Design System Unification (5 days)

This is the **structural blocker** affecting every visual update thereafter. Must be done first.

#### Task 4: Consolidate Theme Tokens & Create Unified Components

**Files:**
- Modify: `apps/mobile/theme/sawaa/colors.ts`
- Create: `apps/mobile/theme/sawaa/components.ts`
- Delete: `theme/components/ThemedButton.tsx`, `theme/components/ThemedCard.tsx`, `theme/components/ThemedText.tsx`, `theme/context/ThemeContext.tsx`

- [ ] **Step 1: Map all hardcoded hex values**

Search for all instances of hex colors in the codebase:
```bash
grep -r "#[0-9a-fA-F]\{6\}" apps/mobile/app apps/mobile/components apps/mobile/theme --include="*.tsx" --include="*.ts" | wc -l
```

Expected: ~43 matches (confirmed by audit).

Document them by color:
- `#1D4ED8` → primary blue (used 43 times per audit, mainly in Themed*)
- `#0037B0` → darker blue variant
- `#7C3AED` → purple (used in some buttons)
- Others from sawaaColors

- [ ] **Step 2: Expand colors.ts with missing tokens**

In `apps/mobile/theme/sawaa/colors.ts`, add:

```typescript
export const sawaaColors = {
  // Existing Sawaa Glass colors
  glass: 'rgba(255, 255, 255, 0.8)',
  // ...

  // Token-based system (for tenant branding)
  primary: {
    light: '#1D4ED8',     // Default primary (can be overridden by tenant branding)
    dark: '#0037B0',      // Dark variant
  },
  secondary: {
    light: '#7C3AED',
    dark: '#5B21B6',
  },
  accent: {
    light: '#82CC17',     // CareKit lime green (from CLAUDE.md)
    dark: '#65A30D',
  },
  // Map Themed colors
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  muted: '#9CA3AF',
  // ...
};

// Export for branding override (multi-tenant)
export function getBrandingTokens(brandingConfig?: any) {
  if (!brandingConfig) return sawaaColors;
  return {
    ...sawaaColors,
    primary: {
      light: brandingConfig.primaryColor || sawaaColors.primary.light,
      dark: brandingConfig.primaryColorDark || sawaaColors.primary.dark,
    },
  };
}
```

- [ ] **Step 3: Create unified component library**

Create `apps/mobile/theme/sawaa/components.ts`:

```typescript
import { StyleSheet } from 'react-native';
import { sawaaColors } from './colors';

// SawaaButton — unified across all screens
export const SawaaButton = {
  primary: {
    backgroundColor: sawaaColors.primary.light,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: sawaaColors.primary.light,
    padding: 12,
    borderRadius: 8,
  },
  disabled: {
    opacity: 0.5,
  },
};

// SawaaCard — glass morphism
export const SawaaCard = {
  container: {
    backgroundColor: sawaaColors.glass,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
};

// SawaaText — typography
export const SawaaText = {
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    color: '#333',
  },
  caption: {
    fontSize: 12,
    fontWeight: '500',
    color: sawaaColors.muted,
  },
};

export const styles = StyleSheet.create({
  ...SawaaButton,
  ...SawaaCard,
  ...SawaaText,
});
```

- [ ] **Step 4: Write test for token system**

Create `apps/mobile/__tests__/theme-tokens.test.ts`:

```typescript
import { sawaaColors, getBrandingTokens } from '@/theme/sawaa/colors';

describe('Theme Tokens', () => {
  it('should have primary, secondary, accent tokens', () => {
    expect(sawaaColors.primary).toBeDefined();
    expect(sawaaColors.secondary).toBeDefined();
    expect(sawaaColors.accent).toBeDefined();
  });

  it('should support branding override', () => {
    const custom = getBrandingTokens({ primaryColor: '#FF0000' });
    expect(custom.primary.light).toBe('#FF0000');
  });

  it('should not contain hardcoded hex in component definitions', () => {
    // All hex should be in colors.ts, not in components.ts
    const componentFile = require('fs').readFileSync(
      'apps/mobile/theme/sawaa/components.ts',
      'utf8'
    );
    const hexPattern = /#[0-9a-fA-F]{6}/g;
    // Should have no matches (except maybe in comments)
    expect(componentFile.match(hexPattern)).toBeNull();
  });
});
```

Run: `npm run test -- theme-tokens.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/theme/sawaa/{colors,components}.ts apps/mobile/__tests__/theme-tokens.test.ts
git commit -m "refactor(mobile): consolidate theme tokens + unified component exports (SawaaButton, SawaaCard, SawaaText)"
```

---

#### Task 5: Migrate Welcome Screen

**Files:**
- Modify: `apps/mobile/app/(auth)/welcome.tsx`
- Modify: `apps/mobile/components/shared/OrbsAnimation.tsx` (if Themed refs exist)

- [ ] **Step 1: Audit current welcome.tsx**

Read `apps/mobile/app/(auth)/welcome.tsx` to identify:
- All Themed* imports
- All hardcoded hex colors
- Layout structure (should stay same, just swap styling)
- Animation imports (Orbs should move to Sawaa)

- [ ] **Step 2: Replace Themed imports with Sawaa**

Before:
```typescript
import { ThemedButton, ThemedText } from '@/theme/components/Themed*';
import { useTheme } from '@/theme/context/ThemeContext';

const { colors } = useTheme();
```

After:
```typescript
import { SawaaButton, SawaaText } from '@/theme/sawaa/components';
import { sawaaColors } from '@/theme/sawaa/colors';
```

- [ ] **Step 3: Update all button renders**

Before:
```typescript
<TouchableOpacity style={[ThemedButton.primary, { backgroundColor: colors.primary }]}>
  <ThemedText>{t('auth.login')}</ThemedText>
</TouchableOpacity>
```

After:
```typescript
<TouchableOpacity style={SawaaButton.primary}>
  <Text style={SawaaText.body}>{t('auth.login')}</Text>
</TouchableOpacity>
```

- [ ] **Step 4: Fix font name on welcome**

Audit found `getFontName('ar', '700')` hardcoded. Replace with:
```typescript
import { useDir } from '@/hooks/useDir';

const { locale } = useDir();
const fontFamily = getFontName(locale, '700');  // Dynamic, not hardcoded 'ar'
```

- [ ] **Step 5: Manual QA**

Deploy welcome screen → verify:
1. Buttons match Sawaa Glass style (no solid blue block)
2. Text readable in both AR and EN
3. Orbs animation plays (1.6s) without jank
4. Swipe to next screen works

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/\(auth\)/welcome.tsx apps/mobile/components/shared/OrbsAnimation.tsx
git commit -m "refactor(mobile): migrate welcome screen from Themed to Sawaa Glass"
```

---

#### Task 6: Migrate Login & Register Screens

**Files:**
- Modify: `apps/mobile/app/(auth)/login.tsx`
- Modify: `apps/mobile/app/(auth)/register.tsx`

Same pattern as Task 5:
1. Replace Themed* imports with Sawaa
2. Remove hardcoded hex colors (#1D4ED8 → sawaaColors.primary.light)
3. Update button/text/card styles
4. Ensure RTL compatibility (use useDir(), logical properties)
5. Manual QA (both AR and EN, light mode, all form states)
6. Commit

Estimated time: 2 hours each = 4 hours total

---

#### Task 7: Migrate Forgot-Password & Reset-Password Screens

**Files:**
- Modify: `apps/mobile/app/(auth)/forgot-password.tsx`
- Modify: `apps/mobile/app/(auth)/reset-password.tsx`

Same pattern as Tasks 5–6.

Estimated time: 2 hours each = 4 hours total

---

#### Task 8: Migrate Employee Tabs (Today, Calendar, Clients, Profile)

**Files:**
- Modify: `apps/mobile/app/(employee)/(tabs)/today.tsx`
- Modify: `apps/mobile/app/(employee)/(tabs)/calendar.tsx`
- Modify: `apps/mobile/app/(employee)/(tabs)/clients.tsx`
- Modify: `apps/mobile/app/(employee)/(tabs)/profile.tsx`

Same pattern as earlier tasks, but also:
1. Remove ThemedText/ThemedButton/ThemedCard usage
2. Fix status labels (already done in Task 3 — just use new imports)
3. Ensure table styles work with Sawaa (no dark blue backgrounds, use glass)
4. Verify calendar grid layout (react-native-calendars styling)
5. Manual QA: as employee, verify all 4 tabs display correctly

Estimated time: 3 hours total (4 screens × 45 min each)

---

#### Task 9: Migrate Settings Screen

**Files:**
- Modify: `apps/mobile/app/(client)/settings.tsx`

Remove Themed*, replace with Sawaa. Special focus:
1. Settings cards (ThemedCard → SawaaCard)
2. Toggle/switch styling (keep haptics)
3. Profile section styling (if split into separate component, migrate that too)

Estimated time: 1 hour

---

#### Task 10: Delete Themed System & Lint Rule

**Files:**
- Delete: `theme/components/ThemedButton.tsx`
- Delete: `theme/components/ThemedCard.tsx`
- Delete: `theme/components/ThemedText.tsx`
- Delete: `theme/context/ThemeContext.tsx`
- Modify: `.eslintrc.json` (or similar)
- Add: `apps/mobile/.eslintrc.json` custom rule

- [ ] **Step 1: Verify no remaining imports of Themed***

Run:
```bash
grep -r "from.*Themed" apps/mobile/app apps/mobile/components --include="*.tsx" --include="*.ts"
```

Expected: 0 matches (if any, finish migration first)

- [ ] **Step 2: Delete files**

```bash
git rm apps/mobile/theme/components/ThemedButton.tsx
git rm apps/mobile/theme/components/ThemedCard.tsx
git rm apps/mobile/theme/components/ThemedText.tsx
git rm apps/mobile/theme/context/ThemeContext.tsx
```

- [ ] **Step 3: Add ESLint rule to prevent hex colors**

In `apps/mobile/.eslintrc.json`, add custom rule:
```json
{
  "rules": {
    "no-restricted-syntax": [
      "error",
      {
        "selector": "Literal[value=/#[0-9a-fA-F]{6}/]",
        "message": "Hardcoded hex color detected. Use token from sawaaColors instead."
      }
    ]
  }
}
```

(If ESLint doesn't support this natively, use a custom rule via eslint-plugin-local-rules.)

- [ ] **Step 4: Verify lint passes**

Run: `npm run lint --filter=@carekit/mobile`

Expected: 0 hex color violations

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/.eslintrc.json
git commit -m "refactor(mobile): delete Themed system, add hex-color lint rule"
```

---

### Phase 3: Booking Flow & P1 UX (3–4 days)

#### Task 11: Fix Progress Indicator in Booking Flow (P1-2)

**Files:**
- Modify: `apps/mobile/app/booking/[serviceId].tsx:20-30` (step count display)
- Modify: `apps/mobile/app/booking/schedule.tsx:50-60` (step count)
- Modify: `apps/mobile/app/booking/confirm.tsx:60-70` (step count)
- Modify: `apps/mobile/app/booking/payment.tsx:10-20` (ADD step indicator)

Current bug: "Step 3 of 3" then payment (hidden step).

- [ ] **Step 1: Document current flow**

Map the booking flow:
1. Service selector (`[serviceId].tsx`) — "Step 1 of 4"
2. Schedule (`schedule.tsx`) — "Step 2 of 4"
3. Confirm (`confirm.tsx`) — "Step 3 of 4"
4. Payment (`payment.tsx`) — "Step 4 of 4" (new)

- [ ] **Step 2: Update step displays**

In `booking/[serviceId].tsx`:
```typescript
<ProgressBar value={25} /> {/* 1 of 4 */}
<Text>{t('booking.step', { current: 1, total: 4 })}</Text>
```

In `booking/schedule.tsx`:
```typescript
<ProgressBar value={50} /> {/* 2 of 4 */}
<Text>{t('booking.step', { current: 2, total: 4 })}</Text>
```

In `booking/confirm.tsx`:
```typescript
<ProgressBar value={75} /> {/* 3 of 4 */}
<Text>{t('booking.step', { current: 3, total: 4 })}</Text>
```

In `booking/payment.tsx`:
```typescript
<ProgressBar value={85} /> {/* 4 of 4, but show 85% (not "completed" yet) */}
<Text>{t('booking.step', { current: 4, total: 4 })}</Text>
```

- [ ] **Step 3: Manual QA**

1. Start booking flow
2. Verify step count increments 1/4 → 2/4 → 3/4 → 4/4
3. Verify progress bar fills incrementally
4. Verify on payment screen, step still shows (not hidden)

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/booking/{[serviceId],schedule,confirm,payment}.tsx
git commit -m "fix(mobile): correct booking flow progress indicator (3 of 3 → 4 of 4, show on payment)"
```

---

#### Task 12: Extend Booking Schedule from 7 Days to Calendar (P1-3)

**Files:**
- Modify: `apps/mobile/app/booking/schedule.tsx`
- Test: `apps/mobile/__tests__/booking-schedule.test.ts` (new)

Current: `for i < 7` (hardcoded 7-day limit). Need: full calendar + quick-access week bar.

- [ ] **Step 1: Write test for schedule availability**

Create `apps/mobile/__tests__/booking-schedule.test.ts`:

```typescript
import { getAvailableSlots } from '@/lib/booking-helpers';

describe('Booking Schedule', () => {
  it('should support booking up to 30 days in advance', () => {
    const today = new Date();
    const maxDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    const slots = getAvailableSlots(today, maxDate);
    expect(slots.length).toBeGreaterThan(7);
  });

  it('should return empty array for past dates', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const slots = getAvailableSlots(yesterday, yesterday);
    expect(slots.length).toBe(0);
  });
});
```

Run: `npm run test -- booking-schedule.test.ts`
Expected: FAIL

- [ ] **Step 2: Create booking helper**

Create `apps/mobile/lib/booking-helpers.ts`:

```typescript
export function getAvailableSlots(startDate: Date, endDate: Date) {
  // Placeholder: call API with date range
  // For now, generate fake slots for demo
  const slots = [];
  let current = new Date(startDate);

  while (current <= endDate) {
    if (isWeekday(current)) {
      // Add slots for 9am–6pm in 30-min increments
      for (let hour = 9; hour < 18; hour++) {
        slots.push({
          date: new Date(current),
          time: `${hour}:00`,
          available: Math.random() > 0.3, // 70% availability
        });
      }
    }
    current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
  }

  return slots;
}

function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6; // Exclude Sun/Sat
}
```

- [ ] **Step 3: Update schedule.tsx UI**

Replace the 7-day bar with a two-tier layout:

```typescript
import { Calendar } from 'react-native-calendars';
import { getAvailableSlots } from '@/lib/booking-helpers';

const [selectedDate, setSelectedDate] = useState<Date>(new Date());
const [maxBookingDate] = useState(() => {
  const max = new Date();
  max.setDate(max.getDate() + 30);
  return max;
});

const slots = getAvailableSlots(selectedDate, selectedDate);

return (
  <View>
    {/* Week quick-access bar */}
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {Array.from({ length: 7 }).map((_, i) => {
        const date = new Date();
        date.setDate(date.getDate() + i);
        return (
          <TouchableOpacity
            key={i}
            onPress={() => setSelectedDate(date)}
            style={[
              styles.dayBtn,
              selectedDate.toDateString() === date.toDateString() && styles.dayBtnActive,
            ]}
          >
            <Text>{format(date, 'EEE')}</Text>
            <Text>{format(date, 'd')}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>

    {/* Calendar for month view */}
    <Calendar
      current={selectedDate.toISOString().split('T')[0]}
      minDate={new Date().toISOString().split('T')[0]}
      maxDate={maxBookingDate.toISOString().split('T')[0]}
      onDayPress={(day) => setSelectedDate(new Date(day.dateString))}
      markedDates={{
        [selectedDate.toISOString().split('T')[0]]: {
          selected: true,
          selectedColor: sawaaColors.primary.light,
        },
      }}
    />

    {/* Time slots for selected date */}
    <View style={{ marginTop: 16 }}>
      <Text style={SawaaText.heading}>{t('booking.availableSlots')}</Text>
      <FlatList
        data={slots}
        keyExtractor={(item) => `${item.date}-${item.time}`}
        renderItem={({ item }) => (
          <TouchableOpacity
            disabled={!item.available}
            onPress={() => handleSelectSlot(item)}
            style={[
              styles.slot,
              !item.available && { opacity: 0.5 },
            ]}
          >
            <Text>{item.time}</Text>
          </TouchableOpacity>
        )}
        numColumns={3}
      />
    </View>
  </View>
);
```

- [ ] **Step 4: Run test**

Run: `npm run test -- booking-schedule.test.ts`
Expected: PASS

- [ ] **Step 5: Manual QA**

1. Open booking flow → Schedule step
2. Verify calendar displays 30 days (not 7)
3. Select a date in week 2 → slots update
4. Verify quick-access week bar still works
5. Verify timezone displays correctly (next task fixes hardcoded Riyadh)

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/booking/schedule.tsx apps/mobile/lib/booking-helpers.ts apps/mobile/__tests__/booking-schedule.test.ts
git commit -m "feat(mobile): extend booking schedule from 7 days to 30-day calendar with week quick-access"
```

---

#### Task 13: Fix Hardcoded "Riyadh Time" & Placeholder Names (P1-4, P1-5, P1-7)

**Files:**
- Modify: `apps/mobile/app/booking/schedule.tsx:197` (timezone display)
- Modify: `apps/mobile/app/(client)/(tabs)/home.tsx:29, 77` (greeting logic)
- Test: `apps/mobile/__tests__/greeting.test.ts` (new)

- [ ] **Step 1: Write test for time-aware greeting**

Create `apps/mobile/__tests__/greeting.test.ts`:

```typescript
import { getGreeting } from '@/lib/greeting-helpers';

describe('Greeting Messages', () => {
  it('should return morning greeting before 12:00', () => {
    const morning = new Date();
    morning.setHours(9, 0, 0);

    const greeting = getGreeting(morning, 'ar');
    expect(greeting).toMatch(/صباح|morning/i);
  });

  it('should return afternoon greeting 12:00–18:00', () => {
    const afternoon = new Date();
    afternoon.setHours(14, 0, 0);

    const greeting = getGreeting(afternoon, 'ar');
    expect(greeting).toMatch(/مساء/i);
  });

  it('should return evening greeting after 18:00', () => {
    const evening = new Date();
    evening.setHours(20, 0, 0);

    const greeting = getGreeting(evening, 'ar');
    expect(greeting).toMatch(/مساء/i);
  });

  it('should not include placeholder names', () => {
    const greeting = getGreeting(new Date(), 'ar');
    expect(greeting).not.toContain('سارة');
    expect(greeting).not.toContain('Sarah');
  });
});
```

Run: `npm run test -- greeting.test.ts`
Expected: FAIL

- [ ] **Step 2: Create greeting helper**

Create `apps/mobile/lib/greeting-helpers.ts`:

```typescript
import { useTranslation } from '@react-native-i18n/react-i18n';

export function getGreeting(date: Date, locale: string, firstName?: string): string {
  const hour = date.getHours();
  let timeOfDay: 'morning' | 'afternoon' | 'evening';

  if (hour < 12) timeOfDay = 'morning';
  else if (hour < 18) timeOfDay = 'afternoon';
  else timeOfDay = 'evening';

  const key = `greeting.${timeOfDay}`;

  if (firstName) {
    return `${key} ${firstName}`;  // Caller should i18n this
  }

  return key;  // Return i18n key, not translated string
}
```

- [ ] **Step 3: Update home.tsx**

In `apps/mobile/app/(client)/(tabs)/home.tsx`, replace:

Before:
```typescript
const greeting = firstName ?? 'سارة'; // ← WRONG
<Text>{t('greeting.morning')} {greeting}</Text>
```

After:
```typescript
import { getGreeting } from '@/lib/greeting-helpers';

const greetingKey = getGreeting(new Date(), locale, firstName ? firstName : undefined);
// If firstName exists, concatenate; otherwise use key-only version
<Text>
  {firstName
    ? `${t(`greeting.${getGreetingTimeOfDay(new Date())}`)} ${firstName}`
    : t(`greeting.${getGreetingTimeOfDay(new Date())}_noname`)}
</Text>
```

Add to i18n:
```json
{
  "greeting": {
    "morning": "صباح الخير",
    "morning_noname": "صباح الخير",
    "afternoon": "مساء النور",
    "afternoon_noname": "مساء النور",
    "evening": "مساء الخير",
    "evening_noname": "مساء الخير"
  }
}
```

- [ ] **Step 4: Fix Riyadh timezone hardcode**

In `apps/mobile/app/booking/schedule.tsx`, find:

Before:
```typescript
<Text>{t('booking.riyadhTime')}</Text>
```

After:
```typescript
import { useBranch } from '@/hooks/useBranch';

const { branch } = useBranch(); // Get org's branch config
const timezone = branch?.timezone || 'Asia/Riyadh'; // Fallback, but prefer branch timezone
const tzName = getTimezoneName(timezone); // e.g., "وقت الرياض" or "Gulf Standard Time"

<Text>{t('booking.timezone', { tz: tzName })}</Text>
```

Create helper `apps/mobile/lib/timezone-helpers.ts`:

```typescript
export function getTimezoneName(tz: string): string {
  const map: Record<string, { ar: string; en: string }> = {
    'Asia/Riyadh': { ar: 'وقت الرياض', en: 'Riyadh Time' },
    'Asia/Dubai': { ar: 'وقت الإمارات', en: 'UAE Time' },
    'Asia/Kuwait': { ar: 'وقت الكويت', en: 'Kuwait Time' },
    // Add more as needed
  };
  return map[tz] || tz;
}
```

- [ ] **Step 5: Run test**

Run: `npm run test -- greeting.test.ts`
Expected: PASS

- [ ] **Step 6: Manual QA**

1. Open home screen as client (logged in with name)
   - Verify greeting: if 9am → "صباح الخير أحمد"
   - If 2pm → "مساء النور أحمد"
   - If 8pm → "مساء الخير أحمد"
2. Test as client with NO name in profile
   - Verify greeting: "صباح الخير" (no "سارة")
3. Open booking → Schedule step
   - Verify timezone displays branch timezone, not hardcoded Riyadh
   - Test with org in Dubai, Kuwait

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/{lib,app}/booking/schedule.tsx apps/mobile/app/\(client\)/\(tabs\)/home.tsx apps/mobile/lib/{greeting,timezone}-helpers.ts apps/mobile/__tests__/greeting.test.ts
git commit -m "fix(mobile): time-aware greetings, remove placeholder names, dynamic timezone from branch config"
```

---

#### Task 14: Fix Booking Confirm VAT Hardcode & Fetch Service by ID (P1-6, P1-8)

**Files:**
- Modify: `apps/mobile/app/booking/confirm.tsx:19, 70-75`

Current bugs:
- VAT 15% hardcoded in UI
- Full catalog loaded, service found via linear search

- [ ] **Step 1: Check backend**

Verify backend booking endpoint returns:
```json
{
  "id": "...",
  "serviceId": "...",
  "subtotal": 100,
  "vat": 15,
  "total": 115,
  "...": "..."
}
```

If VAT not yet in booking response, file a backend task (for owner review, compliance-sensitive).

- [ ] **Step 2: If VAT is in response, update confirm.tsx**

Before:
```typescript
const VAT_RATE = 0.15;
const vat = subtotal * VAT_RATE;
const total = subtotal + vat;
```

After:
```typescript
// VAT already calculated by backend
const { subtotal, vat, total } = bookingData;
```

- [ ] **Step 3: Replace catalog search with service ID endpoint**

Before:
```typescript
useEffect(() => {
  // Load all services
  const allServices = await serviceService.getAll();
  const service = allServices.find(s => s.id === serviceId);
  setService(service);
}, []);
```

After:
```typescript
// Create hook
const { data: service } = useService(serviceId);
```

Create hook in `apps/mobile/hooks/queries/useService.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export function useService(serviceId: string) {
  return useQuery({
    queryKey: ['service', serviceId],
    queryFn: async () => {
      const response = await apiClient.get(`/public/services/${serviceId}`);
      return response.data;
    },
  });
}
```

- [ ] **Step 4: Manual QA**

1. Start booking flow → Confirm step
2. Verify prices shown match backend (no local VAT calc)
3. Verify service details load without full catalog

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/booking/confirm.tsx apps/mobile/hooks/queries/useService.ts
git commit -m "fix(mobile): remove VAT hardcode, fetch service by ID (not full catalog)"
```

---

### Phase 4: P1 Performance & Accessibility (2 days)

#### Task 15: Replace ScrollView with FlatList (P1-7, P2-7)

**Files:**
- Modify: `apps/mobile/app/(client)/(tabs)/appointments.tsx`
- Modify: `apps/mobile/app/(client)/(tabs)/notifications.tsx`
- Modify: `apps/mobile/app/(client)/(tabs)/chat.tsx`

Audit found ScrollView used for lists that could have 50–100+ items.

- [ ] **Step 1: Audit current structure**

Check each file for:
```typescript
<ScrollView>
  {bookings.map((booking) => <BookingCard key={...} />)}
</ScrollView>
```

- [ ] **Step 2: Replace with FlatList**

Before:
```typescript
<ScrollView refreshControl={...}>
  {data.map((item) => (
    <Card key={item.id}>{/* ... */}</Card>
  ))}
</ScrollView>
```

After:
```typescript
<FlatList
  data={data}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <Card>{/* ... */}</Card>}
  refreshControl={<RefreshControl ... />}
  onEndReached={() => {
    if (hasMore) fetchMore();
  }}
  onEndReachedThreshold={0.3}
/>
```

- [ ] **Step 3: For chat with lots of messages, use `inverted` prop**

```typescript
<FlatList
  data={messages}
  inverted
  renderItem={({ item }) => <Message {...item} />}
  // ...
/>
```

- [ ] **Step 4: Manual QA**

1. Scroll through list with 50+ items
2. Verify no jank/lag
3. Verify refresh control still works
4. Verify infinite scroll (if enabled)

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/\(client\)/\(tabs\)/{appointments,notifications,chat}.tsx
git commit -m "perf(mobile): replace ScrollView with FlatList for variable-length lists"
```

---

#### Task 16: Reduce Home Animation Stagger (P2-8)

**Files:**
- Modify: `apps/mobile/app/(client)/(tabs)/home.tsx`

Audit found 5 sections with 600–800ms stagger each → final section appears after ~1.5s.

- [ ] **Step 1: Audit current stagger**

Find animation definitions in `home.tsx`:
```typescript
const staggeredDelay = index * 600; // ← Too long
```

- [ ] **Step 2: Reduce delays**

Option A: Reduce each delay to 50–100ms:
```typescript
const staggeredDelay = index * 50; // ← Total ~250ms for 5 sections
```

Option B: Remove stagger after critical content (hero + greeting):
```typescript
// First section: staggered
// Therapist row: immediate
// Chat/notifications/etc: immediate
```

Recommendation: **Option B** — stagger only header, load rest immediately.

- [ ] **Step 3: Update animation**

Before:
```typescript
<Animated.View style={[styles.section, { opacity: fadeIn }]}>
  {/* Each section delays 600ms */}
</Animated.View>
```

After:
```typescript
const headerDelay = 0;
const contentDelay = 300; // Only header staggers, rest are immediate

<Animated.View style={[styles.greeting, { opacity: fadeInHeader }]}>
  {/* Greeting staggers 0–300ms */}
</Animated.View>

<ScrollView>
  {/* Therapist row, chat, notifications: render immediately */}
</ScrollView>
```

- [ ] **Step 4: Manual QA**

1. Open app → Home screen
2. Verify greeting + header appear with smooth fade (~300ms)
3. Verify rest of content loads immediately (no 1.5s wait)
4. Measure with Lighthouse: LCP should improve

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/\(client\)/\(tabs\)/home.tsx
git commit -m "perf(mobile): reduce home screen animation stagger (1.5s → 300ms)"
```

---

#### Task 17: Add A11y Annotations (P1 & P2-X)

**Files:**
- Modify: 15+ screens (all auth + client + employee tabs)

Audit found only 27 a11y annotations for 30+ screens.

- [ ] **Step 1: Priority a11y areas**

High impact:
- OTP inputs: `accessibilityLabel="OTP box N of 6"`
- Booking flow: step labels, button descriptions
- Employee screens: status badges, availability indicators

- [ ] **Step 2: Add annotations to otp-verify.tsx**

```typescript
<TextInput
  accessibilityLabel={t('otp.inputLabel', { number: 1, total: 6 })}
  accessibilityHint={t('otp.inputHint')}
  textContentType="oneTimeCode"
  // ...
/>
```

i18n:
```json
{
  "otp": {
    "inputLabel": "خانة كود التحقق $number من $total",
    "inputHint": "أدخل رقماً واحداً من كود التحقق الذي تلقيته عبر SMS"
  }
}
```

- [ ] **Step 3: Add to booking flow**

```typescript
// In confirm.tsx
<View accessibilityRole="alert" accessibilityLabel={t('booking.priceBreakdown')}>
  <Text>{t('booking.subtotal')}: ...</Text>
  <Text>{t('booking.vat')}: ...</Text>
  <Text accessibilityRole="header">{t('booking.total')}: ...</Text>
</View>
```

- [ ] **Step 4: Add to employee screens**

```typescript
// In today.tsx
<StatusPill
  status={item.status}
  accessible={true}
  accessibilityLabel={t(`appointments.${item.status}_label`)}
  accessibilityRole="text"
/>
```

- [ ] **Step 5: Test with VoiceOver**

1. Enable VoiceOver on iOS simulator
2. Navigate through screens
3. Verify all interactive elements have labels
4. Verify screen readers announce status changes (booking confirmed, etc.)

- [ ] **Step 6: Commit (batch)**

```bash
git add apps/mobile/app/\(auth\)/*.tsx apps/mobile/app/\(client\)/*.tsx apps/mobile/app/\(employee\)/*.tsx
git commit -m "a11y(mobile): add accessibility labels + roles to 15 screens (OTP, booking, employee)"
```

---

#### Task 18: Add Reduce-Motion Support (P2, a11y)

**Files:**
- Create: `apps/mobile/hooks/useReduceMotionEnabled.ts`
- Modify: `(tabs)/home.tsx`, `auth/welcome.tsx`, any screen with heavy animations

- [ ] **Step 1: Create hook**

```typescript
import { useAccessibilityInfo } from 'react-native-accessibility-info';

export function useReduceMotionEnabled() {
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);

  useEffect(() => {
    useAccessibilityInfo().reduceMotionEnabled().then(setReduceMotionEnabled);
  }, []);

  return reduceMotionEnabled;
}
```

- [ ] **Step 2: Conditionally disable animations**

```typescript
const reduceMotion = useReduceMotionEnabled();

<Animated.View
  style={[
    styles.fadeIn,
    !reduceMotion && { opacity: fadeAnim }, // ← Only animate if enabled
  ]}
/>
```

- [ ] **Step 3: Manual QA**

1. Enable "Reduce Motion" in iOS Accessibility Settings
2. Open app
3. Verify no animations (instant rendering)
4. Disable "Reduce Motion"
5. Verify animations return

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/hooks/useReduceMotionEnabled.ts apps/mobile/app/**/*.tsx
git commit -m "a11y(mobile): respect system reduce-motion preference"
```

---

## Testing Scope

### Unit Tests
- Theme tokens (no hardcoded hex)
- Status label mapping
- Greeting time-aware logic
- Booking schedule dates (7 days → 30 days)

### Manual QA (Chrome DevTools MCP)
- **Auth flow**: OTP autofill (iOS), reset-password, login/register
- **Client flow**: Home greeting, booking flow (4 steps), chat nav trap fixed
- **Employee flow**: Today/Calendar/Clients tabs (status labels correct, no Themed*)
- **Settings**: Dark mode toggle (fixed or removed), profile section
- **Accessibility**: VoiceOver on all major screens, reduce-motion support
- **Performance**: Home LCP < 2s, list scrolling 60fps

### Regression Tests
- Existing unit tests still pass (1025+ from prior phases)
- No new ESLint violations (hex color rule)
- All tenant-isolation e2e pass (unchanged by mobile work)

---

## Commit Messages

Follow conventional format:
```
<type>(<scope>): <message>

Examples:
feat(mobile): add SMS OTP autofill
fix(mobile): remove chat nav trap
perf(mobile): replace ScrollView with FlatList
refactor(mobile): unify Sawaa Glass design system
a11y(mobile): add accessibility labels to 15 screens
```

---

## Rollback Plan

If a phase blocks the app:
1. **Phase 1 (P0 quick wins):** Revert specific commits (OTP, chat, status labels) independently
2. **Phase 2 (Design system):** Revert design-system branch; all work is localized to theme/
3. **Phase 3–4:** Revert feature branches; no platform-wide changes

---

## Success Criteria

- [ ] All P0 blockers resolved (design unified, OTP works, chat nav fixed, status labels correct)
- [ ] All P1 improvements merged (progress, 7-day → 30-day, greeting, timezone)
- [ ] No hardcoded hex colors (#1D4ED8, etc.) — lint enforces this
- [ ] No Themed* imports remain — delete confirmed
- [ ] Manual QA: 9/9 PASS on iOS (AR + EN, light mode, VoiceOver spot-check)
- [ ] Unit tests: all new + existing pass
- [ ] Regression: no regressions in booking, chat, settings, employee tabs
