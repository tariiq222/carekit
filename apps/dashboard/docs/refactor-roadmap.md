# Refactor Roadmap — CareKit Dashboard

> **الغرض:** جدول صيانة دوري لمنع تراكم الدين التقني.
> **التحديث:** بعد كل sprint، راجع هذا الملف وحدّث حالة كل بند.
> **المبدأ:** الكود الجيد يحتاج صيانة دورية — لا يكفي أن تكتبه صحيحاً مرة واحدة.

---

## الحالة الحالية — Current State

> آخر تحديث: 2026-03-26 | بعد Phase 8

| المعيار | الحالة |
|---------|--------|
| DS Compliance | ✅ 100% |
| File Size Limits | ✅ كل الملفات < 350 سطر |
| Cross-feature imports | ✅ 0 مخالفات (ESLint enforced) |
| Layer violations | ✅ 0 مخالفات |
| Type safety | ✅ strict mode |
| staleTime coverage | ✅ semi-static queries محمية |
| Hook ownership | ✅ feature-specific hooks co-located |
| Contract unification | ✅ shared types مركزية |

---

## دورة الصيانة — Maintenance Cycles

### 🔴 أسبوعي — مع كل PR

هذه الفحوصات تجري تلقائياً عبر ESLint/TypeScript:

```bash
npm run typecheck   # 0 errors مطلوب
npm run lint        # 0 errors مطلوب
```

الفحص اليدوي:
- [ ] لا ملف جديد يتجاوز 350 سطر
- [ ] كل feature جديدة مضافة في `eslint.config.mjs → FEATURES`

---

### 🟡 شهري — Monthly Audit

#### 1. File Size Audit

```bash
# ابحث عن ملفات تقترب من الحد
find . -name "*.tsx" -o -name "*.ts" | \
  xargs wc -l | sort -rn | head -20
```

**الحد الأحمر:** أي ملف > 280 سطر يحتاج مراجعة فورية.
**الإجراء:** قسّم بحسب المسؤولية (SRP).

#### 2. Hook Ownership Review

فحص: هل هناك hooks في `hooks/` تستخدم في feature واحدة فقط؟

```bash
# ابحث عن كل hook وكم مرة يُستخدم
grep -r "from \"@/hooks/use-" components/ --include="*.tsx" | \
  sed 's/.*use-/use-/' | sort | uniq -c | sort -n
```

**الإجراء:** أي hook يظهر في feature واحدة فقط → انقله داخل الـ feature.

#### 3. Shared Component Review

فحص: هل هناك مكونات داخل feature تُستخدم في 3+ features؟

**الإجراء:** انقلها لـ `components/features/*.tsx` (shared root).

#### 4. staleTime Review

فحص: هل هناك queries جديدة بدون `staleTime`؟

```bash
grep -r "useQuery" hooks/ --include="*.ts" -A5 | grep -L "staleTime"
```

**الإجراء:** أضف `staleTime` مناسب (5/10/30 دقيقة).

---

### 🔵 ربع سنوي — Quarterly Deep Audit

#### Q1: Dependency Audit

```bash
npm outdated          # ما الذي قديم؟
npm audit             # هل هناك ثغرات أمنية؟
```

**الأولويات للتحديث:**
1. `next` — أهم شيء (security + performance)
2. `@tanstack/react-query` — API stability
3. `zod` — schema changes
4. `tailwindcss` — token compatibility

#### Q2: Translation Coverage

فحص: هل كل key مستخدم في الكود موجود في ملفات الترجمة؟

```bash
# مثال: ابحث عن مفاتيح مستخدمة
grep -r "t(\"" components/ --include="*.tsx" | \
  grep -oP '(?<=t\(")[\w.]+' | sort -u
```

**الإجراء:** أضف أي key ناقص في `en.*` و `ar.*`.

#### Q3: Dead Code Audit

- هل هناك components غير مستخدمة في `components/features/`؟
- هل هناك hooks غير مستخدمة في `hooks/`؟
- هل هناك types غير مستخدمة في `lib/types/`؟

```bash
# TypeScript strict mode يمسك معظمها تلقائياً
npm run typecheck
```

#### Q4: Performance Review

- هل هناك `useEffect` للـ data fetching (يجب استبداله بـ `useQuery`)؟
- هل هناك `useState` لـ server state؟
- هل computed values محاطة بـ `useMemo`؟

```bash
grep -r "useEffect" hooks/ --include="*.ts"
grep -r "setState.*fetch\|fetch.*setState" components/ --include="*.tsx"
```

---

## سجل الإنجازات — Completed Refactors

### Phase 3 — Contract Unification (2026-03-26)
- ✅ إنشاء `lib/types/intake-form-shared.ts` كمصدر واحد للـ enums
- ✅ توحيد `BookingStatus` بين `booking.ts` و `ds.ts`
- ✅ cascade updates على `status-badge.tsx`, `booking-actions.tsx`, `practitioner-bookings-chart.tsx`

### Phase 4 — Separation of Concerns (2026-03-26)
- ✅ إنشاء `hooks/use-clinic-settings.ts` (7 hooks)
- ✅ إزالة direct TanStack Query calls من 4 settings components
- ✅ نقل computed stats من pages إلى hooks

### Phase 5 — Hook Ownership (2026-03-26)
- ✅ نقل `use-booking-slots.ts` → `components/features/bookings/`
- ✅ نقل `use-booking-form-resets.ts` → `components/features/bookings/`
- ✅ تحديث `ARCHITECTURE.md` بقاعدة Hook Ownership
- ✅ ESLint architectural boundary rules (19 features)

### Phase 6 — Performance (2026-03-26)
- ✅ `useMemo` على computed values في `use-practitioners.ts`, `use-patients.ts`
- ✅ `staleTime` على semi-static queries (categories, clinic settings, email templates, zatca)
- ✅ `staleTime` على list queries (5 min) وdetail queries (10 min)
- ✅ استبدال raw `<select>` و `<input type="checkbox">` بـ shadcn في `form-preview-dialog.tsx`

### Phase 7 — DS Governance (2026-03-26)
- ✅ نقل 5 inline styles في `login-form.tsx` → CSS classes في `globals.css`
- ✅ نقل progress bar width → `.rating-bar` CSS class
- ✅ DS compliance: 100%

### Phase 8 — Enterprise Readiness (2026-03-26)
- ✅ `CONTRIBUTING.md` — onboarding guide
- ✅ `CODEOWNERS` — feature ownership map
- ✅ `docs/refactor-roadmap.md` — هذا الملف
- ✅ `ARCHITECTURE.md` — تحديث بـ boundaries الرسمية

---

## الدين التقني المعروف — Known Technical Debt

| البند | الأولوية | الخطة |
|-------|----------|-------|
| `<input type="radio">` في `form-preview-dialog.tsx` | منخفضة | أضف `RadioGroup` لـ `components/ui/` |
| `use-mobile.ts` في `hooks/` (تقييم: هل يستخدم في 3+ features؟) | منخفضة | راجع في الـ monthly audit القادم |
| Missing schemas: `waitlist`, `gift-card`, `email-template`, `activity-log`, `notification`, `report` | متوسطة | أضف عند أول form لكل feature |
| `use-clinic-settings.ts` يضم queries وmutations معاً | منخفضة | قد يُقسم لاحقاً إذا كبر |

---

## قرارات معمارية — Architecture Decision Records (ADR)

### ADR-001: Flat hooks structure
**القرار:** إبقاء `hooks/` flat (لا subfolders).
**السبب:** البساطة تفوق فائدة التنظيم الإضافي في الحجم الحالي.
**التاريخ:** 2026-03-26

### ADR-002: No `.all` invalidation pattern change
**القرار:** إبقاء `queryKeys.[feature].all` في mutations.
**السبب:** صحيح معمارياً — list mutations تحتاج invalidation واسع.
**التاريخ:** 2026-03-26

### ADR-003: CSS variables for dynamic values
**القرار:** استخدام `style={{ "--var": value } as CSSProperties}` + CSS class تستهلك المتغير.
**السبب:** الحل الوحيد لتمرير قيم ديناميكية بدون inline style مباشر.
**التاريخ:** 2026-03-26

### ADR-004: staleTime strategy
**القرار:** 5 min للـ lists، 10 min للـ details، 30 min للـ config.
**السبب:** موازنة بين freshness وعدد الطلبات في بيئة عيادة.
**التاريخ:** 2026-03-26
