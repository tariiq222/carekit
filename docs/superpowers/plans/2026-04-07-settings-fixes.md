# Settings Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** إصلاح 6 مشاكل مكتشفة في صفحة الإعدادات — أمنية وسلوكية وبنيوية.

**Architecture:** الإصلاحات موزعة على: backend (whitelabel.service.ts للأسرار المكشوفة)، dashboard hooks/components (Zoom toggle، widget cache key، double-save)، وإزالة تكرار `SwitchRow`.

**Tech Stack:** NestJS, Next.js 15, TanStack Query v5, TypeScript strict

---

## ملف الخريطة

| الملف | التغيير |
|-------|---------|
| `backend/src/modules/whitelabel/whitelabel.service.ts` | إضافة `email_api_key` و`zoom_client_secret` لـ SENSITIVE_KEYS |
| `dashboard/components/features/settings/settings-integrations-tab.tsx` | إصلاح Zoom toggle — يحفظ فوراً + إخفاء المفاتيح المحجوبة |
| `dashboard/components/features/settings/advanced-cancellation-card.tsx` | إزالة `SwitchRow` المكرر (استخدام نسخة booking-tab) — في الواقع النسختان مختلفتان بالـ className، إصلاح double-save |
| `dashboard/components/features/settings/cancellation-tab.tsx` | إصلاح double-save: حذف استدعاء `scheduleSave()` من onChange النصي |
| `dashboard/hooks/use-clinic-settings.ts` | إصلاح widget branding invalidation key |
| `backend/src/modules/bookings/booking-settings.controller.ts` | توحيد الصلاحيات: PATCH يستخدم `bookings:edit` بدل `whitelabel:edit` |

---

## Task 1: Backend — إضافة email_api_key و zoom_client_secret لـ SENSITIVE_KEYS

**Files:**
- Modify: `backend/src/modules/whitelabel/whitelabel.service.ts:19-21`

- [ ] **Step 1: قراءة السطور الحالية**

```bash
grep -n "SENSITIVE_KEYS" backend/src/modules/whitelabel/whitelabel.service.ts
```

Expected output:
```
19:  private static readonly SENSITIVE_KEYS = [
20:    'moyasar_secret_key',
21:  ];
```

- [ ] **Step 2: إضافة المفاتيح المحجوبة**

في `backend/src/modules/whitelabel/whitelabel.service.ts`، غيّر السطور 19-21 من:
```ts
  private static readonly SENSITIVE_KEYS = [
    'moyasar_secret_key',
  ];
```
إلى:
```ts
  private static readonly SENSITIVE_KEYS = [
    'moyasar_secret_key',
    'email_api_key',
    'zoom_client_secret',
  ];
```

- [ ] **Step 3: تحقق من السلوك الحالي للـ mask**

```bash
grep -n "maskSensitive\|SENSITIVE_KEYS\|masked" backend/src/modules/whitelabel/whitelabel.service.ts
```

تأكد أن `maskSensitive` تُطبَّق على كل `getConfig()` وأن `getConfigMap()` يمر عبرها (السطر 122 يستخدم `getConfig()` التي تُطبق الـ mask قبل الإرجاع).

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/whitelabel/whitelabel.service.ts
git commit -m "fix(whitelabel): mask email_api_key and zoom_client_secret in config responses"
```

---

## Task 2: Backend — توحيد صلاحيات BookingSettings PATCH

**Files:**
- Modify: `backend/src/modules/bookings/booking-settings.controller.ts`

**السياق:** حالياً `GET /booking-settings` يستخدم `bookings:view` بينما `PATCH /booking-settings` يستخدم `whitelabel:edit`. المنطقي أن تكون `bookings:edit`.

- [ ] **Step 1: تغيير الصلاحية**

في `backend/src/modules/bookings/booking-settings.controller.ts`، غيّر:
```ts
  @Patch()
  @CheckPermissions({ module: 'whitelabel', action: 'edit' })
  async update(@Body() dto: UpdateBookingSettingsDto) {
```
إلى:
```ts
  @Patch()
  @CheckPermissions({ module: 'bookings', action: 'edit' })
  async update(@Body() dto: UpdateBookingSettingsDto) {
```

- [ ] **Step 2: تحقق من وجود permission `bookings:edit` في النظام**

```bash
grep -rn "'bookings'" backend/src/modules/permissions/ | grep -v ".spec." | head -20
```

تأكد أن `bookings` module موجود في قائمة الـ permissions المتاحة.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/bookings/booking-settings.controller.ts
git commit -m "fix(bookings): align PATCH booking-settings to use bookings:edit permission"
```

---

## Task 3: Dashboard — إصلاح Widget branding invalidation key

**Files:**
- Modify: `dashboard/hooks/use-clinic-settings.ts:166`

**السياق:** المفتاح `["widget", "branding"]` غير مُعرَّف في `queryKeys` — لا يُبطل أي cache فعلياً.

- [ ] **Step 1: التحقق من query keys الموجودة للـ widget**

```bash
grep -n "widget" dashboard/lib/query-keys.ts
grep -rn '"widget"' dashboard/hooks/ | grep -v "branding"
```

- [ ] **Step 2: إزالة السطر الزائد**

في `dashboard/hooks/use-clinic-settings.ts`، في `useWidgetSettingsMutation`، احذف السطر:
```ts
      queryClient.invalidateQueries({ queryKey: ["widget", "branding"] })
```

الدالة تصبح:
```ts
export function useWidgetSettingsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<WidgetSettings>) => updateBookingSettings(data as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinic-settings", "widget"] })
      queryClient.invalidateQueries({ queryKey: BOOKING_SETTINGS_KEY })
    },
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/hooks/use-clinic-settings.ts
git commit -m "fix(settings): remove invalid widget branding cache invalidation key"
```

---

## Task 4: Dashboard — إصلاح Zoom Toggle (يحفظ فوراً)

**Files:**
- Modify: `dashboard/components/features/settings/settings-integrations-tab.tsx`

**السياق:** الـ toggle لـ Zoom يغير الحالة محلياً فقط — يجب أن يُحفظ فوراً مثل Payment tab.

- [ ] **Step 1: تعديل منطق Zoom toggle**

في `settings-integrations-tab.tsx`، ابحث عن تعريف الـ `tabs` array وغيّر:
```ts
    {
      id: "zoom",
      label: t("settings.zoom"),
      desc: t("settings.zoomDesc"),
      enabled: zoomEnabled,
      onToggle: setZoomEnabled,
    },
```
إلى:
```ts
    {
      id: "zoom",
      label: t("settings.zoom"),
      desc: t("settings.zoomDesc"),
      enabled: zoomEnabled,
      onToggle: (v: boolean) => {
        setZoomEnabled(v)
        updateConfig.mutate(
          { configs: [{ key: "zoom_enabled", value: String(v), type: "boolean" as const }] },
          {
            onSuccess: () => toast.success(t("settings.saved")),
            onError: () => toast.error(t("settings.error")),
          }
        )
      },
    },
```

- [ ] **Step 2: إصلاح زر "Enable" في الـ disabled state**

ابحث عن:
```tsx
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setZoomEnabled(true)}
                  disabled={updateConfig.isPending}
                >
```
غيّره إلى:
```tsx
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setZoomEnabled(true)
                    updateConfig.mutate(
                      { configs: [{ key: "zoom_enabled", value: "true", type: "boolean" as const }] },
                      {
                        onSuccess: () => toast.success(t("settings.saved")),
                        onError: () => toast.error(t("settings.error")),
                      }
                    )
                  }}
                  disabled={updateConfig.isPending}
                >
```

- [ ] **Step 3: إخفاء حقول السر في حالة masked**

بعد Task 1 في الباكند، ستُرجَع قيمة `zoom_client_secret` كـ `"***"`. يجب أن لا نعيد إرسالها.

في `handleSaveZoom`، ابحث عن:
```ts
  const handleSaveZoom = () => {
    updateConfig.mutate(
      {
        configs: [
          { key: "zoom_enabled", value: String(zoomEnabled), type: "boolean" as const },
          { key: "zoom_client_id", value: zoomClientId },
          { key: "zoom_client_secret", value: zoomClientSecret },
          { key: "zoom_account_id", value: zoomAccountId },
        ],
      },
```
غيّره إلى:
```ts
  const handleSaveZoom = () => {
    const configs: { key: string; value: string; type?: "string" | "boolean" | "number" | "json" }[] = [
      { key: "zoom_enabled", value: String(zoomEnabled), type: "boolean" },
      { key: "zoom_client_id", value: zoomClientId },
      { key: "zoom_account_id", value: zoomAccountId },
    ]
    // Only send secret if user actually typed a new value (not the masked placeholder)
    if (zoomClientSecret && zoomClientSecret !== "***") {
      configs.push({ key: "zoom_client_secret", value: zoomClientSecret })
    }
    updateConfig.mutate(
      { configs },
```

- [ ] **Step 4: نفس الإصلاح لـ handleSaveEmail**

في `handleSaveEmail`:
```ts
  const handleSaveEmail = () => {
    const configs: { key: string; value: string; type?: "string" | "boolean" | "number" | "json" }[] = [
      { key: "email_provider", value: emailProvider },
      { key: "email_from", value: emailFrom },
    ]
    // Only send API key if user typed a new value
    if (emailApiKey && emailApiKey !== "***") {
      configs.push({ key: "email_api_key", value: emailApiKey })
    }
    updateConfig.mutate(
      { configs },
      {
        onSuccess: () => toast.success(t("settings.saved")),
        onError: () => toast.error(t("settings.error")),
      },
    )
  }
```

- [ ] **Step 5: إضافة helper text لحقول المحجوبة**

HTML placeholders لا تظهر إلا عندما يكون الحقل فارغًا — لذا يجب استخدام helper text بدلاً منها.

في حقل `zoomClientSecret`، غيّر:
```tsx
                  <Input
                    value={zoomClientSecret}
                    onChange={(e) => setZoomClientSecret(e.target.value)}
                    type="password"
                    dir="ltr"
                  />
```
إلى:
```tsx
                  <Input
                    value={zoomClientSecret}
                    onChange={(e) => setZoomClientSecret(e.target.value)}
                    type="password"
                    dir="ltr"
                    placeholder="Enter new secret"
                  />
                  {zoomClientSecret === "***" && (
                    <p className="text-xs text-muted-foreground">
                      {t("settings.secretAlreadyConfigured")}
                    </p>
                  )}
```

في حقل `emailApiKey`:
```tsx
                <Input
                  value={emailApiKey}
                  onChange={(e) => setEmailApiKey(e.target.value)}
                  type="password"
                  placeholder="re_..."
                  dir="ltr"
                />
                {emailApiKey === "***" && (
                  <p className="text-xs text-muted-foreground">
                    {t("settings.secretAlreadyConfigured")}
                  </p>
                )}
```

- [ ] **Step 6: typecheck**

```bash
cd dashboard && npm run typecheck 2>&1 | tail -20
```

Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add dashboard/components/features/settings/settings-integrations-tab.tsx
git commit -m "fix(settings): zoom toggle saves immediately, secrets skip masked placeholder on save"
```

---

## Task 5: Dashboard — إصلاح Double-Save في CancellationTab

**Files:**
- Modify: `dashboard/components/features/settings/cancellation-tab.tsx`
- Modify: `dashboard/components/features/settings/advanced-cancellation-card.tsx`

**السياق:** `useAutoSave.scheduleSave()` يُجدوِل حفظاً بعد 1500ms، وزر Save يُطلق حفظاً فورياً — إذا ضغط المستخدم Save بعد تعديل نصي، يحدث طلبان. الإصلاح: `scheduleSave` يجب أن يُلغي أي timer معلق عند الضغط على Save (وهذا ما تفعله `saveNow` بالفعل). الحل: استخدام `saveNow` بدل استدعاء `onSave` مباشرة في onClick.

- [ ] **Step 1: في cancellation-tab.tsx — إصلاح CancellationPolicyPanel**

في `CancellationPolicyPanel`، ابحث عن:
```tsx
      <Button size="sm" disabled={isPending || !isDirty} onClick={() => onSave(data)}>
```
غيّره إلى:
```tsx
      <Button size="sm" disabled={isPending || !isDirty} onClick={saveNow}>
```

- [ ] **Step 2: في advanced-cancellation-card.tsx — إصلاح AdvancedCancellationPanel**

```tsx
      <Button size="sm" disabled={isPending || !isDirty} onClick={saveNow}>
```
(بدل `onClick={() => onSave(data)}`)

- [ ] **Step 3: نفس الإصلاح لـ ReschedulingPanel**

```tsx
      <Button size="sm" disabled={isPending || !isDirty} onClick={saveNow}>
```

- [ ] **Step 4: نفس الإصلاح لـ NoShowPanel**

```tsx
      <Button size="sm" disabled={isPending || !isDirty} onClick={saveNow}>
```

- [ ] **Step 5: typecheck**

```bash
cd dashboard && npm run typecheck 2>&1 | tail -10
```

Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add dashboard/components/features/settings/cancellation-tab.tsx \
        dashboard/components/features/settings/advanced-cancellation-card.tsx
git commit -m "fix(settings): use saveNow on Save button to prevent double-save race condition"
```

---

## Task 6: Dashboard — إضافة Moyasar Secret لـ write-only في الـ Payment Tab

**Files:**
- Modify: `dashboard/components/features/settings/settings-payment-tab.tsx`

**السياق:** الباكند يُرجع `moyasar_secret_key` كـ `"***"` (موجود في SENSITIVE_KEYS). لكن الـ frontend يُرسله مجدداً عند الحفظ.

- [ ] **Step 1: إصلاح handleSaveMoyasar**

ابحث عن:
```ts
  const handleSaveMoyasar = () => {
    updateConfig.mutate(
      { configs: [
        { key: "moyasar_publishable_key", value: moyasarKey },
        { key: "moyasar_secret_key", value: moyasarSecret },
      ]},
```
غيّره إلى:
```ts
  const handleSaveMoyasar = () => {
    const configs: { key: string; value: string; type?: "string" | "boolean" | "number" | "json" }[] = [
      { key: "moyasar_publishable_key", value: moyasarKey },
    ]
    if (moyasarSecret && moyasarSecret !== "***") {
      configs.push({ key: "moyasar_secret_key", value: moyasarSecret })
    }
    updateConfig.mutate(
      { configs },
      { onSuccess: () => toast.success(t("settings.saved")), onError: () => toast.error(t("settings.error")) }
    )
  }
```

- [ ] **Step 2: إضافة placeholder لحقل الـ secret**

ابحث عن حقل `moyasarSecret`:
```tsx
                    <Input value={moyasarSecret} onChange={(e) => setMoyasarSecret(e.target.value)} placeholder="sk_live_..." type="password" dir="ltr" />
```
غيّره إلى:
```tsx
                    <Input value={moyasarSecret} onChange={(e) => setMoyasarSecret(e.target.value)} placeholder={moyasarSecret === "***" ? "••••••••••••" : "sk_live_..."} type="password" dir="ltr" />
```

- [ ] **Step 3: typecheck**

```bash
cd dashboard && npm run typecheck 2>&1 | tail -10
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/features/settings/settings-payment-tab.tsx
git commit -m "fix(settings): skip masked moyasar secret on save to prevent overwriting with placeholder"
```

---

## Self-Review

### Spec Coverage

| المشكلة | Task |
|---------|------|
| أسرار email_api_key/zoom_client_secret مكشوفة | Task 1 ✅ |
| Moyasar secret يُرسل مجدداً عند الحفظ | Task 6 ✅ |
| Booking settings permission تضارب | Task 2 ✅ |
| Widget branding cache key خاطئ | Task 3 ✅ |
| Zoom toggle لا يحفظ فوراً | Task 4 ✅ |
| Double-save في cancellation | Task 5 ✅ |

### ملاحظات إضافية

- **SwitchRow المكرر:** النسختان مختلفتان قليلاً في الـ className (`py-4` vs `py-3`) — تركناه عمداً لأن الدمج يحتاج refactoring أوسع خارج نطاق هذه الإصلاحات.
- **General Tab email validation:** الـ browser validation كافٍ هنا — الباكند يتحقق أيضاً.
- **Notifications dual-source:** مشكلة UX لكن ليست bug حقيقية — تُترك لـ iteration لاحقة.

### Placeholder Scan
لا يوجد TBD أو TODO في الخطة.

### Type Consistency
جميع الـ `configs` arrays مُكتوبة بنفس النوع: `{ key: string; value: string; type?: "string" | "boolean" | "number" | "json" }[]`.
