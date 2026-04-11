/**
 * Arabic translations — Groups
 */

export const arGroups: Record<string, string> = {
  "nav.groups": "الخدمات الجماعية",

  "groups.title": "الخدمات الجماعية",
  "groups.description": "إدارة الجلسات الجماعية والدورات التدريبية",
  "groups.addGroup": "إضافة مجموعة",
  "groups.created": "تم إنشاء المجموعة بنجاح",
  "groups.updated": "تم تحديث المجموعة بنجاح",
  "groups.noGroups": "لا توجد مجموعات بعد",
  "groups.noGroupsDesc": "ابدأ بإضافة مجموعة جديدة",

  "groups.name": "الاسم",
  "groups.practitioner": "الممارس",
  "groups.deliveryMode": "طريقة التوصيل",
  "groups.date": "التاريخ",
  "groups.enrolled": "المسجلون",
  "groups.status": "الحالة",
  "groups.startTime": "وقت البدء",
  "groups.paymentStatus": "حالة الدفع",
  "groups.attendance": "الحضور",
  "groups.enrollmentStatus": "حالة التسجيل",

  "groups.searchPlaceholder": "ابحث عن مجموعة...",
  "groups.filterByStatus": "فلتر بالحالة",
  "groups.filterByDelivery": "فلتر بطريقة التوصيل",

  "groups.patient": "المريض",
  "groups.patientId": "معرّف المريض",
  "groups.patientIdPlaceholder": "أدخل UUID المريض",
  "groups.addPatient": "إضافة مريض",
  "groups.enroll": "تسجيل",
  "groups.patientEnrolled": "تم تسجيل المريض بنجاح",
  "groups.removePatient": "إزالة المريض",
  "groups.issueCertificate": "إصدار شهادة",

  "groups.cancelGroup": "إلغاء المجموعة",
  "groups.completeGroup": "إنهاء المجموعة",
  "groups.groupCompleted": "تم إنهاء المجموعة",
  "groups.markAttendance": "تسجيل الحضور",
  "groups.setDate": "تحديد الموعد",
  "groups.dateSet": "تم تحديد الموعد بنجاح",

  "groups.noEnrollments": "لا يوجد تسجيلات",
  "groups.noEnrollmentsDesc": "لم يتم تسجيل أي مريض بعد",

  /* ── Create Page ── */
  "groups.create.pageTitle": "إضافة مجموعة جديدة",
  "groups.create.pageDescription": "أنشئ جلسة جماعية أو دورة تدريبية جديدة",
  "groups.create.submit": "إنشاء المجموعة",
  "groups.create.submitting": "جارٍ الإنشاء...",
  "groups.create.cancel": "إلغاء",
  "groups.create.success": "تم إنشاء المجموعة بنجاح",
  "groups.create.error": "فشل في إنشاء المجموعة",
  "groups.create.formError": "يرجى التحقق من الحقول المطلوبة",
  "groups.create.practitionerRequired": "يرجى اختيار ممارس أولاً",

  /* ── Tabs ── */
  "groups.create.tabs.general": "المعلومات العامة",
  "groups.create.tabs.scheduling": "الجدولة والتسعير",
  "groups.create.tabs.settings": "الإعدادات",
  "groups.create.tabs.practitioners": "الممارسون",

  /* ── General Tab ── */
  "groups.create.nameAr": "الاسم (عربي)",
  "groups.create.nameEn": "الاسم (إنجليزي)",
  "groups.create.descAr": "الوصف (عربي)",
  "groups.create.descEn": "الوصف (إنجليزي)",
  "groups.create.minParticipants": "الحد الأدنى للمشاركين",
  "groups.create.maxParticipants": "الحد الأقصى للمشاركين",

  /* ── Scheduling & Price Tab ── */
  "groups.create.durationMinutes": "المدة (بالدقائق)",
  "groups.create.pricePerPerson": "السعر للفرد (هللة)",
  "groups.create.paymentType": "نوع الدفع",
  "groups.create.paymentType.FREE_HOLD": "مجاني",
  "groups.create.paymentType.DEPOSIT": "عربون",
  "groups.create.paymentType.FULL_PAYMENT": "دفع كامل",
  "groups.create.depositAmount": "مبلغ العربون (هللة)",
  "groups.create.remainingDueDate": "تاريخ استحقاق المبلغ المتبقي",
  "groups.create.paymentDeadlineHours": "ساعات مهلة الدفع",
  "groups.create.schedulingMode": "نمط الجدولة",
  "groups.create.schedulingMode.fixed_date": "تاريخ محدد",
  "groups.create.schedulingMode.on_capacity": "عند اكتمال العدد",
  "groups.create.startTime": "وقت البدء",
  "groups.create.endDate": "تاريخ الانتهاء (اختياري)",

  /* ── Settings Tab ── */
  "groups.create.deliveryMode": "طريقة التوصيل",
  "groups.create.deliveryMode.in_person": "حضوري",
  "groups.create.deliveryMode.online": "أونلاين",

  "groups.create.location": "الموقع",
  "groups.create.meetingLink": "رابط الاجتماع",
  "groups.create.isPublished": "نشر المجموعة",
  "groups.create.expiresAt": "تاريخ انتهاء الصلاحية",

  "groups.resendPayment": "إعادة إرسال طلب الدفع",
  "groups.markAttended": "تسجيل حضور",
  "groups.markAbsent": "تسجيل غياب",
  "groups.triggerPayment": "طلب الدفع من الجميع",
  "groups.editGroup": "تعديل المجموعة",
  "groups.edit.pageTitle": "تعديل المجموعة",
  "groups.edit.pageDescription": "تحديث بيانات المجموعة",
  "groups.edit.submit": "حفظ التغييرات",
  "groups.edit.submitting": "جاري الحفظ...",
  "groups.edit.success": "تم تحديث المجموعة بنجاح",
  "groups.edit.error": "فشل تحديث المجموعة",
  "groups.delete.title": "حذف المجموعة",
  "groups.delete.confirm": "هل أنت متأكد من حذف هذه المجموعة؟ لا يمكن التراجع عن هذا الإجراء.",
  "groups.cancel.title": "إلغاء المجموعة",
  "groups.cancel.confirm": "هل أنت متأكد من إلغاء هذه المجموعة؟ سيتم إشعار جميع المسجلين.",
}
