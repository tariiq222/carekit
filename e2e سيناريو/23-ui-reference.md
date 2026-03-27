# مرجع UI — موديول الخدمات (الأزرار، الحالات، الـ Toasts)

## الأزرار ونصوصها

| الزر | النص (EN) | النص (AR) | الحالة أثناء التحميل |
|------|-----------|-----------|----------------------|
| إضافة خدمة (قائمة) | Add Service | إضافة خدمة | — |
| إنشاء خدمة (نموذج) | Create Service | إنشاء خدمة | Creating... / جاري الإنشاء... |
| تعديل خدمة (نموذج) | Edit Service | تعديل الخدمة | Updating... / جاري التحديث... |
| إلغاء | Cancel | إلغاء | — |
| العودة للخدمات | Back to Services | العودة إلى الخدمات | — |
| تأكيد الحذف (خدمة) | Delete | حذف | Deleting... / جاري الحذف... |
| إضافة فئة | Add Category | إضافة فئة | — |
| إنشاء فئة (نموذج) | Create | إنشاء | Creating... / جاري الإنشاء... |
| حفظ فئة (تعديل) | Save | حفظ | Saving... / جاري الحفظ... |
| تعديل (قائمة / شيت) | Edit | تعديل | — |
| حذف (قائمة / شيت) | Delete | حذف | — |
| السابق (pagination) | Previous | السابق | — |
| التالي (pagination) | Next | التالي | — |
| إزالة اللون | Clear | إزالة | — |
| إضافة نموذج | Add Form | إضافة نموذج | — |
| إنشاء نموذج (inline) | Create | إنشاء | Creating... / جاري الإنشاء... |
| إلغاء النموذج | Cancel | إلغاء | — |
| إضافة حقل | Add Field | إضافة حقل | — |
| حفظ الحقول | Save Fields | حفظ الحقول | Saving... / جاري الحفظ... |
| إضافة خيار مدة | Add Option | إضافة خيار | — |
| حفظ خيارات المدة | Save Options | حفظ الخيارات | Saving... / جاري الحفظ... |

---

## Toasts — رسائل النجاح والفشل

| الحدث | Toast نجاح | Toast فشل |
|-------|-----------|-----------|
| إنشاء خدمة | `services.create.success` | خطأ أول من validation أو `services.formError` |
| تعديل خدمة | `services.edit.success` | خطأ أول من validation أو `services.formError` |
| حذف خدمة | `services.delete.success` | رسالة الـ API أو `services.delete.error` |
| إنشاء فئة | `services.categories.create.success` | رسالة الـ API أو `services.categories.create.error` |
| تعديل فئة | `services.categories.edit.success` | رسالة الـ API أو `services.categories.edit.error` |
| حذف فئة | `services.categories.delete.success` | رسالة الـ API أو `services.categories.delete.error` |
| إنشاء نموذج | Form created / تم إنشاء النموذج | Failed to create form / فشل إنشاء النموذج |
| حذف نموذج | Form deleted / تم حذف النموذج | Failed to delete form / فشل حذف النموذج |
| حفظ الحقول | Fields saved / تم حفظ الحقول | Failed to save fields / فشل حفظ الحقول |
| حفظ خيارات المدة | Duration options saved / تم حفظ خيارات المدة | Failed to save duration options |
| حفظ أنواع الحجز | `services.bookingTypes.saved` | Failed to save pricing / `services.bookingTypes.noTypes` |

---

## حالات الـ UI (States)

### صفحة قائمة الخدمات

| الحالة | ما يظهر |
|--------|---------|
| تحميل | 4 Skeleton بطاقات للإحصائيات + 4-5 Skeleton صفوف في الجدول |
| بيانات موجودة | جدول + إحصائيات (Total، Active، Inactive، Categories) |
| قائمة فارغة | `services.empty.title` + `services.empty.description` |
| خطأ API | ErrorBanner مع رسالة الخطأ |
| قائمة فئات فارغة | `services.categories.empty.title` + `services.categories.empty.description` |

### صفحة إنشاء / تعديل خدمة

| الحالة | ما يظهر |
|--------|---------|
| وضع إنشاء | 4 تبويبات — تبويب Intake معطّل مع tooltip |
| وضع تعديل — تحميل | Skeleton للعنوان والتبويبات والمحتوى |
| وضع تعديل — غير موجود | `services.notFound.title` + `services.notFound.desc` + زر العودة |
| وضع تعديل — بيانات موجودة | 4 تبويبات مفعّلة بالكامل |
| إرسال النموذج | الأزرار معطّلة، نص التحميل على زر الإرسال |

### تبويب أنواع الحجز

| الحالة | ما يظهر |
|--------|---------|
| نوع معطّل | بطاقة بحدود منقطة + Toggle فقط |
| نوع مفعّل | بطاقة كاملة: سعر + مدة + خيارات المدة |
| خيارات المدة مخفية | زر collapsible مع عدد الخيارات `({count})` |
| خيارات المدة مفتوحة | شبكة خيارات مع Delete لكل خيار |

### تبويب إعدادات الحجز

| الحالة | ما يظهر |
|--------|---------|
| Buffer غير مفعّل | Checkbox فقط + hint الإعداد العام |
| Buffer مفعّل | Checkbox + Input بوحدة "min" |
| allowRecurring=false (global) | قسم Recurring مخفي كلياً |
| allowRecurring مفعّل في النموذج | أنماط التكرار تظهر |
| أنماط مختارة | Input `maxRecurrences` يظهر |
| لون التقويم فارغ | Color picker بدون زر Clear |
| لون التقويم محدد | Color picker + زر Clear |

### نماذج الاستقبال (Intake Forms)

| الحالة | ما يظهر |
|--------|---------|
| تحميل | Loading... / جاري التحميل... |
| لا توجد نماذج | No intake forms yet / لا توجد نماذج بعد |
| نماذج موجودة | قائمة بطاقات (العنوان + badges + أيقونات) |
| showCreate=false | زر "Add Form" فقط |
| showCreate=true | حقلا EN/AR + Required toggle + زرا إنشاء وإلغاء |
| isEditing=form.id | محرر الحقول مفتوح مع Save Fields |
| dirty=true | زر Save Fields يظهر |

---

## Dialogs والـ Sheets

| المكوّن | النوع | المحتوى |
|---------|-------|---------|
| حذف خدمة | AlertDialog | العنوان + اسم الخدمة في الوصف + Cancel + Delete |
| حذف فئة | AlertDialog | العنوان + اسم الفئة في الوصف + Cancel + Delete |
| إنشاء فئة | Sheet (side=left) | nameEn* + nameAr* + sortOrder + Cancel + Create |
| تعديل فئة | Sheet (side=left) | nameEn + nameAr + sortOrder + isActive toggle + Cancel + Save |
| تفاصيل خدمة | Sheet (side=left) | كل حقول الخدمة + Status badge + Edit + Delete |

---

## أعمدة الجداول

### جدول الخدمات

| العمود | المحتوى |
|--------|---------|
| Service | الاسم (locale) + الوصف (line-clamp-1) |
| Category | اسم الفئة (locale) أو "—" |
| Price (SAR) | عشريتان، tabular-nums |
| Duration | `{n} min` / `{n} دقيقة`، tabular-nums |
| Status | Badge (Active/Inactive) |
| Actions | Dropdown: Edit، Delete |

### جدول الفئات

| العمود | المحتوى |
|--------|---------|
| Category | الاسم (locale) |
| Services | العدد، tabular-nums |
| Sort Order | الرقم، tabular-nums |
| Status | Badge (Active/Inactive) |
| Actions | Dropdown: Edit، Delete |

---

## Badges والألوان

| الحالة | اللون |
|--------|-------|
| Active / نشط | `border-success/30 bg-success/10 text-success` |
| Inactive / غير نشط | `border-muted-foreground/30 bg-muted text-muted-foreground` |
| Required (intake) | variant="secondary" |
| Inactive (intake form) | variant="outline" |

---

## حقول النموذج والـ Validation

| الحقل | القيد |
|-------|-------|
| nameEn / nameAr | مطلوب، min 1 حرف |
| categoryId | مطلوب، UUID صالح |
| calendarColor | اختياري، regex `#[0-9A-Fa-f]{6}` |
| bufferMinutes | اختياري، 0-120 |
| depositPercent | اختياري، 1-100 |
| maxParticipants | اختياري، 1-100 |
| minLeadMinutes | اختياري، 0-1440، nullable |
| maxAdvanceDays | اختياري، 1-365، nullable |
| maxRecurrences | اختياري، 1-52 |

---

## إحصائيات الصفحة الرئيسية (Stats Cards)

| البطاقة | الأيقونة | اللون |
|---------|---------|-------|
| Total (إجمالي الخدمات) | GridIcon | primary |
| Active (النشطة) | CheckmarkCircle02Icon | success |
| Inactive (المعطّلة) | Cancel01Icon | warning |
| Categories (الفئات) | Layers01Icon | accent |
