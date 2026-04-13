# سيناريوهات اختبار E2E — CareKit

## الملفات

### الأولوية العالية

| الملف | الموديول | يشمل |
|-------|---------|------|
| [auth.md](auth.md) | المصادقة | تسجيل، دخول، OTP، refresh token، خروج، تغيير كلمة مرور، تحقق بريد |
| [bookings.md](bookings.md) | الحجوزات | إنشاء، قراءة، متكرر، إعادة جدولة، دورة الحياة، إلغاء، قائمة الانتظار، إعدادات |
| [clients.md](clients.md) | المرضى | قراءة، walk-in، claim، تعديل |
| [payments.md](payments.md) | المدفوعات | Moyasar، webhook، bank transfer، استرداد، قراءة |
| [users-roles-permissions.md](users-roles-permissions.md) | المستخدمون والأدوار والصلاحيات | CRUD مستخدمين، أدوار، صلاحيات، RBAC |

### الأولوية المتوسطة

| الملف | الموديول | يشمل |
|-------|---------|------|
| [branches.md](branches.md) | الفروع | إنشاء، قراءة، تعديل، حذف، إسناد ممارسين |
| [coupons.md](coupons.md) | الكوبونات | إنشاء، قراءة، تعديل، حذف، تطبيق |
| [invoices-zatca.md](invoices-zatca.md) | الفواتير وZATCA | إنشاء، قراءة، HTML، توافق ZATCA |
| [notifications.md](notifications.md) | الإشعارات | قراءة، تحديد مقروء، FCM tokens |
| [intake-forms.md](intake-forms.md) | نماذج الاستقبال | إنشاء، حقول، إجابات، فلترة |
| [reports.md](reports.md) | التقارير | إيرادات، حجوزات، مرضى، تصدير CSV |

### الأولوية المنخفضة

| الملف | الموديول | يشمل |
|-------|---------|------|
| [settings.md](settings.md) | الإعدادات | Whitelabel، ساعات العمل، إجازات، قوالب البريد |
| [activity-log.md](activity-log.md) | سجل النشاط | قراءة، فلترة، تحقق تسجيل تلقائي |
| [specialties.md](specialties.md) | التخصصات | إنشاء، قراءة (عام)، تعديل، حذف |
| [problem-reports.md](problem-reports.md) | تقارير المشاكل | إنشاء، قراءة، حل/رفض |

### مرجعية

| الملف | الموديول | يشمل |
|-------|---------|------|
| [services.md](services.md) | الخدمات | إنشاء، تعديل، حذف، بحث، أنواع الحجز، خيارات المدة |
| [categories.md](categories.md) | الفئات | إنشاء، تعديل، حذف، قراءة |
| [employees.md](employees.md) | الأطباء | إنشاء، تعديل، حذف، قراءة، Onboarding، خدمات الطبيب، المتاحية، Slots، الاستراحات، الإجازات، Buffer |
| [ratings.md](ratings.md) | التقييمات | قراءة، pagination، متوسط |
| [favorites.md](favorites.md) | المفضلة | إضافة، حذف، عزل بين المرضى |
| [ui-reference.md](ui-reference.md) | مرجع UI | أزرار، حالات، Toasts، جداول، Badges |

---

## ملاحظات تقنية

- **توست تعديل الخدمة**: النص الصحيح `"تم تحديث الخدمة بنجاح"` وليس `"تم تعديل"`
- **توست تعديل الفئة**: النص الصحيح `"تم تحديث الفئة بنجاح"`
- **مشكلة الفئة في التعديل**: shadcn Select لا يعكس قيمة `form.reset()` بصرياً — يجب الرجوع لـ Tab 1 وإعادة اختيار الفئة يدوياً قبل الحفظ
- **تحويل الأسعار**: Backend يحفظ هللات (cents)، Frontend يعرض ريال (÷ 100)
- **الخدمات المحذوفة**: soft delete فقط — تبقى في DB وتمنع حذف الفئة
- **هيكل الأسعار الاحتياطي**: 5 مستويات — EmployeeDurationOption → EmployeeServiceType → ServiceBookingType → employee.priceX → service.price
- **Multi-branch Availability**: `branchId` اختياري في كل slot — null يعني "كل الفروع"
- **الإجازات والحذف**: التحقق بعد الحذف عبر GET وليس `deletedAt` مباشرة
- **manifest watcher**: Next.js dev server يُعيد تسمية `app-paths-manifest.json` — شغّل `/tmp/manifest_watch.sh` في الخلفية قبل الاختبارات
