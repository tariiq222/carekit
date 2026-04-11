# Booking Policy Tab — Complete Fix & Enhancement

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all bugs in the booking policy settings tab, add missing fields (maxRecurrences, allowedRecurringPatterns, adminCanBookOutsideHours), and ensure every mutation invalidates all relevant caches so changes reflect everywhere immediately.

**Architecture:** All booking settings go through `PATCH /booking-settings` (one endpoint, one model). The booking flow order uses a separate endpoint (`/clinic/settings/booking-flow`) and stays that way. Cache invalidation is centralized in `useBookingSettingsMutation` so every caller gets it for free. The frontend `booking-tab.tsx` is the only file that needs new UI fields; `BookingSettings` type already has all required fields.

**Tech Stack:** Next.js 15 (App Router), TanStack Query v5, shadcn/ui, Tailwind 4, NestJS 11, Prisma 7

---

## Files Modified

| File | What changes |
|------|-------------|
| `dashboard/hooks/use-organization-settings.ts` | `useBookingSettingsMutation` — add full cache invalidation (widget, public settings, booking-flow-order) |
| `dashboard/components/features/settings/booking-tab.tsx` | Add missing fields in recurring section + adminCanBookOutsideHours + fix paymentTimeout min constraint |
| `dashboard/lib/translations/ar.settings.ts` | Add missing translation keys for new fields |
| `dashboard/lib/query-keys.ts` | Add `widget` and `clinicPublic` keys |

---

## Task 1: Centralize cache invalidation in useBookingSettingsMutation

**Files:**
- Modify: `dashboard/hooks/use-organization-settings.ts`
- Modify: `dashboard/lib/query-keys.ts`

Currently `useBookingSettingsMutation` only invalidates `["booking-settings"]`. Any component reading widget settings or the public clinic config won't see changes.

- [ ] **Step 1: Add widget and clinicPublic keys to query-keys.ts**

Open `dashboard/lib/query-keys.ts`. After the `organizationSettings` block (line 239), the file already has `bookingSettings` and `organizationSettings`. Add `widget` and `clinicPublic` entries:

```typescript
  /* ─── Widget ─── */
  widget: {
    branding: () => ["widget", "branding"] as const,
    settings: () => ["organization-settings", "widget"] as const,
  },

  /* ─── Clinic Public Settings ─── */
  clinicPublic: {
    settings: () => ["organization-settings", "public"] as const,
  },
```

Place these before the closing `} as const` on the last line.

- [ ] **Step 2: Update useBookingSettingsMutation to invalidate all caches**

In `dashboard/hooks/use-organization-settings.ts`, replace the `useBookingSettingsMutation` function (lines 90–98):

```typescript
export function useBookingSettingsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateBookingSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookingSettings.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.widget.branding() })
      queryClient.invalidateQueries({ queryKey: queryKeys.widget.settings() })
      queryClient.invalidateQueries({ queryKey: queryKeys.clinicPublic.settings() })
    },
  })
}
```

- [ ] **Step 3: Update useWidgetSettingsMutation to use the same keys**

In `dashboard/hooks/use-organization-settings.ts`, replace the `useWidgetSettingsMutation` function (lines 160–171) to use `queryKeys`:

```typescript
export function useWidgetSettingsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<WidgetSettings>) => updateBookingSettings(data as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookingSettings.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.widget.branding() })
      queryClient.invalidateQueries({ queryKey: queryKeys.widget.settings() })
      queryClient.invalidateQueries({ queryKey: queryKeys.clinicPublic.settings() })
    },
  })
}
```

- [ ] **Step 4: Run typecheck**

```bash
cd dashboard && npm run typecheck
```
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
# (run from repo root)
git add dashboard/lib/query-keys.ts dashboard/hooks/use-organization-settings.ts
git commit -m "feat(settings): centralize booking settings cache invalidation"
```

---

## Task 2: Add missing translation keys

**Files:**
- Modify: `dashboard/lib/translations/ar.settings.ts`

The new fields (`maxRecurrences`, `allowedRecurringPatterns`, `adminCanBookOutsideHours`) need Arabic translation keys.

- [ ] **Step 1: Add translation keys**

Open `dashboard/lib/translations/ar.settings.ts`. Append these entries before the closing `}`:

```typescript
  // Recurring — missing fields
  "settings.maxRecurrences": "أقصى عدد مواعيد متكررة",
  "settings.maxRecurrencesDesc": "كم موعداً يتكون منها الحجز المتكرر كحد أقصى؟ مثلاً: 12 = سلسلة بحد أقصى 12 موعد.",
  "settings.allowedRecurringPatterns": "الأنماط المسموحة",
  "settings.allowedRecurringPatternsDesc": "حدد الأنماط التي يُسمح للمريض باختيارها عند الحجز المتكرر.",
  "settings.recurringPattern.daily": "يومياً",
  "settings.recurringPattern.every_2_days": "كل يومين",
  "settings.recurringPattern.every_3_days": "كل 3 أيام",
  "settings.recurringPattern.weekly": "أسبوعياً",
  "settings.recurringPattern.biweekly": "كل أسبوعين",
  "settings.recurringPattern.monthly": "شهرياً",
  // Admin outside hours (booking-tab)
  "settings.adminCanBookOutsideHours": "حجز خارج ساعات العمل",
  "settings.adminCanBookOutsideHoursDesc": "يتيح للأدمن إنشاء مواعيد خارج ساعات العمل الرسمية.",
```

- [ ] **Step 2: Run typecheck**

```bash
cd dashboard && npm run typecheck
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
# (run from repo root)
git add dashboard/lib/translations/ar.settings.ts
git commit -m "feat(settings): add missing booking policy translation keys"
```

---

## Task 3: Fix bugs and add missing fields in booking-tab.tsx

**Files:**
- Modify: `dashboard/components/features/settings/booking-tab.tsx`

### Bugs to fix:
1. `paymentTimeoutMinutes` — UI has `min={0}` but DTO enforces `Min(5)`. Change to `min={5}`.
2. `allowedRecurringPatterns` — missing from UI entirely.
3. `maxRecurrences` — missing from UI entirely.
4. `adminCanBookOutsideHours` — missing from UI (exists in schema/DTO).

### Current file is 288 lines — grows to ~320 lines after changes (within acceptable 350-line limit).

- [ ] **Step 1: Add state variables for new fields**

In `booking-tab.tsx`, the state declarations are around lines 62–80. After the existing recurring state (`allowRecurring`), add:

```typescript
  const [maxRecurrences, setMaxRecurrences] = useState("12")
  const [allowedPatterns, setAllowedPatterns] = useState<string[]>(["weekly", "biweekly"])

  // Policies — admin override
  const [adminCanBookOutsideHours, setAdminCanBookOutsideHours] = useState(false)
```

- [ ] **Step 2: Populate new state from settings in useEffect**

In the `useEffect` that reads from `settings` (lines 82–96), add inside the `if (settings)` block:

```typescript
      setMaxRecurrences(String(settings.maxRecurrences ?? 12))
      setAllowedPatterns(settings.allowedRecurringPatterns ?? ["weekly", "biweekly"])
      setAdminCanBookOutsideHours(settings.adminCanBookOutsideHours ?? false)
```

- [ ] **Step 3: Fix paymentTimeout min constraint**

Find this line in the `policies` panel (around line 179):

```tsx
<NumberRow label={t("settings.paymentTimeout")} desc={t("settings.paymentTimeoutDesc")} value={paymentTimeout} onChange={setPaymentTimeout} unit="min" />
```

The `NumberRow` component passes `min={0}` by default. Update `NumberRow` to accept an optional `min` prop, then pass `min={5}` here.

Replace the `NumberRow` component definition (lines 19–34) with:

```tsx
function NumberRow({ label, desc, value, onChange, unit, min = 0 }: {
  label: string; desc: string; value: string; onChange: (v: string) => void; unit: string; min?: number
}) {
  return (
    <div className="flex items-center justify-between py-4 gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} className="w-20 tabular-nums" min={min} />
        <span className="text-xs text-muted-foreground w-6">{unit}</span>
      </div>
    </div>
  )
}
```

Then change the paymentTimeout row to pass `min={5}`:

```tsx
<NumberRow label={t("settings.paymentTimeout")} desc={t("settings.paymentTimeoutDesc")} value={paymentTimeout} onChange={setPaymentTimeout} unit="min" min={5} />
```

- [ ] **Step 4: Add adminCanBookOutsideHours to policies panel save payload**

Find the policies save button onClick (around line 185–192). Add `adminCanBookOutsideHours` to the payload and add the SwitchRow above the save button:

Replace the policies panel content block:

```tsx
{activeTab === "policies" && (
  <div className="space-y-0 max-w-lg">
    <NumberRow label={t("settings.minBookingLead")} desc={t("settings.minBookingLeadDesc")} value={leadMinutes} onChange={setLeadMinutes} unit="min" />
    <Separator />
    <NumberRow label={t("settings.paymentTimeout")} desc={t("settings.paymentTimeoutDesc")} value={paymentTimeout} onChange={setPaymentTimeout} unit="min" min={5} />
    <Separator />
    <NumberRow label={t("settings.bufferMinutes")} desc={t("settings.bufferMinutesDesc")} value={bufferMin} onChange={setBufferMin} unit="min" />
    <Separator />
    <NumberRow label={t("settings.maxAdvanceDays")} desc={t("settings.maxAdvanceDaysDesc")} value={maxAdvanceDays} onChange={setMaxAdvanceDays} unit="days" />
    <Separator />
    <div className="py-4">
      <SwitchRow label={t("settings.adminCanBookOutsideHours")} desc={t("settings.adminCanBookOutsideHoursDesc")} checked={adminCanBookOutsideHours} onChange={setAdminCanBookOutsideHours} />
    </div>
    <div className="flex justify-end pt-5">
      <Button size="sm" disabled={isSaving} onClick={() => handleSettingsSave({
        minBookingLeadMinutes: Number(leadMinutes) || 0,
        paymentTimeoutMinutes: Math.max(5, Number(paymentTimeout) || 60),
        bufferMinutes: Number(bufferMin) || 0,
        maxAdvanceBookingDays: Number(maxAdvanceDays) || 60,
        adminCanBookOutsideHours,
      })}>
        {t("settings.save")}
      </Button>
    </div>
  </div>
)}
```

- [ ] **Step 5: Add maxRecurrences and allowedRecurringPatterns to recurring panel**

Add a `Checkbox` import at the top of the file (alongside existing imports):

```tsx
import { Checkbox } from "@/components/ui/checkbox"
import { RECURRING_PATTERNS } from "@/lib/api/booking-settings"
```

Replace the recurring panel content block (currently lines 245–255):

```tsx
{activeTab === "recurring" && (
  <div className="space-y-4 max-w-lg">
    <SwitchRow label={t("settings.allowRecurring")} desc={t("settings.allowRecurringDesc")} checked={allowRecurring} onChange={setAllowRecurring} />
    {allowRecurring && (
      <>
        <Separator />
        <NumberRow label={t("settings.maxRecurrences")} desc={t("settings.maxRecurrencesDesc")} value={maxRecurrences} onChange={setMaxRecurrences} unit="x" min={1} />
        <Separator />
        <div className="py-2">
          <p className="text-sm font-medium text-foreground mb-1">{t("settings.allowedRecurringPatterns")}</p>
          <p className="text-xs text-muted-foreground mb-3">{t("settings.allowedRecurringPatternsDesc")}</p>
          <div className="grid grid-cols-2 gap-2">
            {RECURRING_PATTERNS.map((p) => (
              <label key={p.value} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={allowedPatterns.includes(p.value)}
                  onCheckedChange={(checked) => {
                    setAllowedPatterns(prev =>
                      checked
                        ? [...prev, p.value]
                        : prev.filter(v => v !== p.value)
                    )
                  }}
                />
                <span className="text-sm">{p.labelAr}</span>
              </label>
            ))}
          </div>
        </div>
      </>
    )}
    <Separator />
    <div className="flex justify-end">
      <Button size="sm" disabled={isSaving} onClick={() => handleSettingsSave({
        allowRecurring,
        maxRecurrences: Number(maxRecurrences) || 12,
        allowedRecurringPatterns: allowedPatterns,
      })}>
        {t("settings.save")}
      </Button>
    </div>
  </div>
)}
```

- [ ] **Step 6: Run typecheck and lint**

```bash
cd dashboard && npm run typecheck && npm run lint
```
Expected: 0 errors, 0 warnings.

- [ ] **Step 7: Commit**

```bash
# (run from repo root)
git add dashboard/components/features/settings/booking-tab.tsx
git commit -m "feat(settings): add missing recurring fields and adminCanBookOutsideHours to booking tab"
```

---

## Task 4: Fix duplicate freeCancelRefundType in cancellation-tab.tsx

**Files:**
- Modify: `dashboard/components/features/settings/cancellation-tab.tsx`

`CancellationPolicyCard` has an `autoRefund` switch that maps to `freeCancelRefundType`. `AdvancedCancellationCard` has a `freeRefund` select that maps to the **same field**. The two panels can contradict each other.

**Fix:** Remove `autoRefund` switch from `CancellationPolicyCard` entirely. The `AdvancedCancellationCard` already controls this field with more precision (full / partial / none).

- [ ] **Step 1: Remove autoRefund state and UI from CancellationPolicyCard**

In `cancellation-tab.tsx`, find `CancellationPolicyCard` (lines 69–116).

Remove:
- `const [autoRefund, setAutoRefund] = useState(false)` 
- `setAutoRefund(settings.freeCancelRefundType === "full")` from useEffect
- The `<SwitchRow ... autoRefund ...>` and its `<Separator />` from JSX
- Remove `freeCancelRefundType` from the `onSave` call in this card (keep only `freeCancelBeforeHours`, `cancellationPolicyEn`, `cancellationPolicyAr`)

The resulting `CancellationPolicyCard` save payload:
```typescript
onSave({
  freeCancelBeforeHours: Number(cancelHours) || 24,
  cancellationPolicyEn: policyEn,
  cancellationPolicyAr: policyAr,
})
```

- [ ] **Step 2: Run typecheck**

```bash
cd dashboard && npm run typecheck
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
# (run from repo root)
git add dashboard/components/features/settings/cancellation-tab.tsx
git commit -m "fix(settings): remove duplicate freeCancelRefundType control from cancellation policy card"
```

---

## Self-Review Checklist

- [x] **Cache invalidation** — Task 1 covers widget, public, and booking-settings keys
- [x] **paymentTimeout min=5** — Task 3 step 3–4
- [x] **maxRecurrences** — Task 3 step 5
- [x] **allowedRecurringPatterns** — Task 3 step 5 (uses `RECURRING_PATTERNS` from `booking-settings.ts`)
- [x] **adminCanBookOutsideHours** — Task 3 step 4
- [x] **Duplicate freeCancelRefundType** — Task 4
- [x] **Translation keys** — Task 2
- [x] **No placeholder steps** — all steps have concrete code
- [x] **Type consistency** — `allowedPatterns` is `string[]`, matches Prisma `RecurringPattern[]` which serializes as string array over JSON
- [x] **File size** — `booking-tab.tsx` grows from 288 to ~320 lines — within 350 limit
