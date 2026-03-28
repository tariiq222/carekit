# Service Avatar — Design Spec
**Date:** 2026-03-29
**Status:** Approved

---

## Overview

كل خدمة تحصل على أفاتار يُعرض في أماكن متعددة (DataTable، detail sheet، صفحة الحجز). العميل يختار إما **أيقونة + لون خلفية** من مكتبة HugeIcons، أو **صورة مرفوعة** تحل محل الأيقونة تماماً.

---

## Priority Logic

```
imageUrl موجود      → عرض الصورة
iconName موجود      → عرض HugeiconsIcon على خلفية iconBgColor
لا شيء             → placeholder: أول حرف من اسم الخدمة على خلفية --primary
```

---

## 1. Database

**Migration جديدة** تضيف 3 حقول لجدول `services`:

```prisma
iconName    String?  @map("icon_name")     // e.g. "StethoscopeIcon"
iconBgColor String?  @map("icon_bg_color") // e.g. "#354FD8"
imageUrl    String?  @map("image_url")     // MinIO URL
```

- الحقول الثلاثة nullable — لا قيمة افتراضية
- Migration مستقلة، لا تُعدّل مهاجرات موجودة

---

## 2. Backend

### DTOs
إضافة للـ `CreateServiceDto` و `UpdateServiceDto`:

```typescript
@IsOptional()
@IsString()
iconName?: string | null

@IsOptional()
@IsString()
@Matches(/^#[0-9A-Fa-f]{6}$/)
iconBgColor?: string | null

@IsOptional()
@IsUrl()
imageUrl?: string | null
```

### Service Layer
- `services.service.ts` يُرجع الحقول الثلاثة في كل response (list + detail)
- لا endpoint جديد للرفع — الصورة تُرفع عبر `StorageModule` (MinIO) المستخدم في whitelabel

---

## 3. Frontend — Components

### `ServiceAvatarPicker` (input)
**الملف:** `dashboard/components/features/services/service-avatar-picker.tsx`

تصميم مطابق لـ `AvatarUpload` الموجود:
- دائرة 80×80 مع `border-dashed border-border`
- زر badge `+` في الكونر (bottom-end) يفتح **Popover** بدل `<input file>` مباشر
- عند وجود قيمة (صورة أو أيقونة) → الزر يتحول لـ `×` يمسح الأفاتار بالكامل
- الـ preview داخل الدائرة يتبع منطق الأولوية أعلاه

**داخل الـ Popover — tabين:**

**Tab "أيقونة":**
- Search input يفلتر أسماء الـ 2938 أيقونة من `@hugeicons/core-free-icons`
- Grid 6 أعمدة مع CSS `contain` لضمان الأداء (virtualization إن احتجنا لاحقاً)
- عند اختيار أيقونة → يظهر row من color swatches لاختيار `iconBgColor`
- ألوان الـ swatches: نفس مجموعة `ColorSwatchInput` الموجودة
- زر "مسح" يصفّر الحقول الثلاثة

**Tab "صورة":**
- `<input file>` يقبل `image/png,image/jpeg,image/webp`
- عند الاختيار → رفع فوري لـ MinIO → يُخزّن الـ URL في `imageUrl`
- preview مباشر
- زر "حذف الصورة"

### `ServiceAvatar` (display)
**الملف:** `dashboard/components/features/services/service-avatar.tsx`

```typescript
interface ServiceAvatarProps {
  iconName?: string | null
  iconBgColor?: string | null
  imageUrl?: string | null
  size?: "sm" | "md" | "lg"  // 32 | 48 | 64
  className?: string
}
```

| المكان | الحجم |
|--------|-------|
| `service-columns.tsx` (DataTable) | `sm` — 32×32 |
| `service-detail-sheet.tsx` | `md` — 48×48 |
| `create-service-dialog.tsx` / `edit-service-dialog.tsx` | عبر `ServiceAvatarPicker` |

---

## 4. Form Integration

**الملف المتأثر:** `dashboard/components/features/services/create/basic-info-tab.tsx`

- `ServiceAvatarPicker` يُضاف في بداية الـ card (فوق الـ Name fields)، مع `border-b` يفصله
- يتكامل مع `react-hook-form` عبر `form.setValue` للحقول الثلاثة
- نفس النمط في `edit-service-dialog.tsx`

**Form schema** — إضافة للـ `createServiceSchema`:
```typescript
iconName:    z.string().nullable().optional()
iconBgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional()
imageUrl:    z.string().url().nullable().optional()
```

---

## 5. Scope

### داخل الـ Scope
- Dashboard: picker + display في list + detail
- Backend: migration + DTOs + service response
- رفع الصورة عبر MinIO

### خارج الـ Scope
- Mobile: يستخدم `imageUrl` فقط (الأيقونة تُضاف لاحقاً)
- i18n لأسماء الأيقونات (البحث يعمل على الاسم الإنجليزي)

---

## 6. Files to Create / Modify

| الملف | الإجراء |
|-------|---------|
| `backend/prisma/schema/services.prisma` | تعديل — إضافة 3 حقول |
| `backend/prisma/migrations/[timestamp]_add_service_avatar/` | إنشاء migration |
| `backend/src/modules/services/dto/create-service.dto.ts` | تعديل |
| `backend/src/modules/services/dto/update-service.dto.ts` | تعديل |
| `backend/src/modules/services/services.service.ts` | تعديل — إرجاع الحقول |
| `dashboard/components/features/services/service-avatar.tsx` | إنشاء |
| `dashboard/components/features/services/service-avatar-picker.tsx` | إنشاء |
| `dashboard/components/features/services/create/basic-info-tab.tsx` | تعديل |
| `dashboard/components/features/services/create/form-schema.ts` | تعديل |
| `dashboard/components/features/services/service-columns.tsx` | تعديل |
| `dashboard/components/features/services/service-detail-sheet.tsx` | تعديل |
| `dashboard/components/features/services/edit-service-dialog.tsx` | تعديل |
| `dashboard/lib/types/service.ts` | تعديل — إضافة الحقول للـ type |
