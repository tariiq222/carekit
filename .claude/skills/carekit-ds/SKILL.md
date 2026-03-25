---
name: carekit-ds
description: >
  CareKit Design System Governor — النظام الموحد الإلزامي لكل عمل UI.
  يُحمّل تلقائياً قبل أي كود Dashboard أو صفحة أو مكون أو تعديل تصميمي.
  يضبط: الألوان، المسافات، الخطوط، الأيقونات، المكونات، RTL، وقواعد الـ Frosted Glass.
triggers:
  - design
  - redesign
  - UI
  - page
  - component
  - layout
  - style
  - improve
  - fix UI
  - build page
  - new component
  - dashboard
  - تصميم
  - تعديل التصميم
  - تحسين
  - صفحة جديدة
  - مكون جديد
  - واجهة
  - audit design
  - unify components
  - DS compliance
  - توحيد المكونات
  - تدقيق التصميم
  - صمم
  - عدّل
  - حسّن
---

# CareKit Design System — القانون الموحد

> **أنت الحاكم (Governor) على كل قرار تصميمي في CareKit Dashboard.**
> أي كود UI يُكتب بدون الالتزام بهذا النظام يُرفض فوراً.

---

## 1. مصادر الحقيقة (Sources of Truth)

اقرأ هذه الملفات بالترتيب قبل أي عمل:

1. `dashboard/DESIGN-SYSTEM.md` — القواعد البصرية والهوية
2. `dashboard/lib/ds.ts` — Type-safe token mappings
3. `dashboard/app/globals.css` — CSS custom properties
4. `dashboard/components/ui/` — المكونات الأساسية (shadcn/ui)
5. `dashboard/components/features/` — المكونات الجاهزة

---

## 2. الهوية البصرية — Frosted Glass

```
Style:        iOS-inspired Frosted Glass (glassmorphism)
Font:         IBM Plex Sans Arabic (RTL-first)
Background:   Animated gradient blobs (primary blue + accent green)
Surfaces:     Semi-transparent with backdrop-filter: blur(24px)
Transitions:  0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)
```

---

## 3. Color Tokens (الألوان — استخدم فقط هذه)

### Primary
| Token | CSS Variable | Value | Usage |
|-------|-------------|-------|-------|
| `text-primary` | `--primary` | `#354FD8` | CTAs, active states, links |
| `bg-primary` | `--primary` | `#354FD8` | Primary buttons |
| `bg-primary/8` | `--primary-ultra-light` | `rgba(53,79,216,0.08)` | Icon backgrounds |

### Surfaces
| Token | CSS Variable | Value | Usage |
|-------|-------------|-------|-------|
| `bg-background` | `--background` | `#F2F4F8` | Page background |
| `bg-card` | `--card` | `rgba(255,255,255,0.72)` | Glass cards |
| `bg-muted` | `--muted` | `#F1F4F8` | Nested sections |
| `bg-popover` | `--popover` | `rgba(255,255,255,0.92)` | Popovers, dropdowns |

### Status
| Token | Value | Usage |
|-------|-------|-------|
| `text-success` / `bg-success/10` | `#16A34A` | Confirmed, paid, active |
| `text-warning` / `bg-warning/10` | `#D97706` | Pending, awaiting |
| `text-error` / `bg-error/10` | `#DC2626` | Cancelled, failed |
| `text-info` / `bg-info/10` | `#2563EB` | Informational |

### ممنوع
```
❌ hex colors في JSX (مثل #354FD8, #fff)
❌ text-gray-*, text-slate-*, text-zinc-*
❌ bg-white, bg-black
❌ أي لون Tailwind arbitrary
```

---

## 4. الأبعاد (Spacing — 8px Grid)

```
gap-2  = 8px     p-2  = 8px
gap-3  = 12px    p-3  = 12px
gap-4  = 16px    p-4  = 16px   ← Card padding
gap-6  = 24px    p-6  = 24px   ← Section spacing
gap-8  = 32px    p-8  = 32px
```

---

## 5. Border Radius

| Token | Size | Usage |
|-------|------|-------|
| `rounded-sm` | 8px | Chips, small pills, badges |
| `rounded-md` | 12px | Inputs, buttons |
| `rounded-lg` | 16px | Cards |
| `rounded-xl` | 20px | Modals, large surfaces |

---

## 6. Shadows

| Class | Usage |
|-------|-------|
| `shadow-sm` | Cards at rest |
| `shadow-md` | Card hover, dropdowns |
| `shadow-lg` | Modals only |
| `shadow-primary` | Primary CTA buttons (blue glow) |

---

## 7. Typography

```
Font:     IBM Plex Sans Arabic
H1:       text-xl font-semibold     (page titles)
H2:       text-base font-medium     (card titles)
Body:     text-sm                    (default)
Caption:  text-xs text-muted-foreground
Numbers:  tabular-nums              ← إجباري على كل الأرقام والمبالغ والتواريخ
```

---

## 8. Glass Classes

```css
.glass        → rgba(255,255,255,0.72) + blur(24px)     /* Cards, panels */
.glass-solid  → rgba(255,255,255,0.88) + blur(24px)     /* Popovers, menus */
.card-lift    → hover: translateY(-2px) + shadow-md      /* Hoverable cards */
```

---

## 9. الأيقونات — Hugeicons فقط

```tsx
import { HugeiconsIcon } from "@hugeicons/react"
import { IconName } from "@hugeicons/core-free-icons"

<HugeiconsIcon icon={IconName} size={20} />
```

```
❌ Lucide React
❌ Font Awesome
❌ Material Icons
❌ أي مكتبة أيقونات أخرى
```

---

## 10. RTL — قواعد إجبارية

```
✅ start / end          ❌ left / right
✅ ps- / pe-            ❌ pl- / pr-
✅ ms- / me-            ❌ ml- / mr-
✅ text-start           ❌ text-left
```

---

## 11. المكونات — إعادة الاستخدام إجبارية

### مكونات أساسية (لا تُنشئ بديلاً)
| المكون | الاستخدام |
|--------|----------|
| `Card` | كل الكروت (glass مدمج) |
| `Button` | كل الأزرار |
| `Input` | كل حقول الإدخال |
| `Select` | كل القوائم المنسدلة |
| `Badge` | كل الشارات |
| `Avatar` | كل الصور الشخصية |
| `Dialog` | كل النوافذ المنبثقة |
| `Sheet` | كل الأدراج الجانبية |
| `Tabs` | كل التبويبات |
| `DataTable` | كل الجداول |
| `Skeleton` | كل حالات التحميل |

### مكونات الصفحة (بنية إجبارية)
```tsx
<ListPageShell>           ← wrapper بـ gap-6
  <PageHeader />          ← عنوان + وصف + زر
  <StatsGrid>             ← شبكة الإحصائيات
    <StatCard />
  </StatsGrid>
  <DataTable />           ← جدول البيانات
</ListPageShell>
```

### حالات الصفحة
```
Loading  → <Skeleton />
Error    → <ErrorBanner />
Empty    → <EmptyState />
```

---

## 12. DS Token Reference (`ds.ts`)

```typescript
import { radius, shadow, glass, text, weight, space,
         stateColors, bookingStatusStyles, surface } from "@/lib/ds"
```

---

## 13. Validation Checklist — قبل كل PR

```
[ ] كل الألوان semantic tokens (لا hex، لا gray-*، لا slate-*)
[ ] كل المسافات على grid 8px
[ ] كل الأرقام/المبالغ/التواريخ بـ tabular-nums
[ ] كل الـ layout بـ start/end (لا left/right)
[ ] كل الـ margins بـ ms-/me- (لا ml-/mr-)
[ ] كل الأيقونات Hugeicons (لا Lucide)
[ ] كل المكونات shadcn/ui (لا raw HTML)
[ ] كل الكروت عليها .glass أو Card component
[ ] كل الملفات أقل من 350 سطر
[ ] CTA واحد primary فقط لكل قسم
[ ] accent للشارات فقط — مش للأزرار أو الخلفيات الكبيرة
[ ] RTL مدعوم بالكامل
```

---

## 14. أدوات التصميم المتاحة

| الأداة | متى تُستخدم |
|--------|-------------|
| **Pencil MCP** | تصميم في ملفات .pen |
| **Chrome DevTools** | سكرين شوت، فحص DOM، اختبار بصري |
| **Playwright** | اختبار responsive، تصوير صفحات |
| **21st Magic** | بناء مكونات من وصف |
| **frontend-architect agent** | blueprints وهيكلة الصفحات |
| **WebFetch** | جلب من figma.com، ui.shadcn.com |

---

## 15. عند الشك — توقف واسأل

إذا لم تجد مكون موجود، أو الحالة غير واضحة، أو التصميم غير محدد:
**لا تخمن — اسأل المايسترو (طارق) قبل ما تبني.**
