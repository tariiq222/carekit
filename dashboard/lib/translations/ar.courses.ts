/**
 * Arabic translations — Courses (الدورات التدريبية)
 */

export const arCourses: Record<string, string> = {
  "nav.courses": "الدورات التدريبية",

  "courses.title": "الدورات التدريبية",
  "courses.description": "إدارة الدورات التدريبية والتسجيلات وتتبع الحضور",

  // Page actions
  "courses.addCourse": "إضافة دورة",
  "courses.editCourse": "تعديل الدورة",
  "courses.deleteCourse": "حذف الدورة",
  "courses.publishCourse": "نشر الدورة",
  "courses.cancelCourse": "إلغاء الدورة",
  "courses.courseCreated": "تم إنشاء الدورة بنجاح",
  "courses.courseUpdated": "تم تحديث الدورة بنجاح",
  "courses.courseDeleted": "تم حذف الدورة بنجاح",
  "courses.coursePublished": "تم نشر الدورة بنجاح",
  "courses.courseCancelled": "تم إلغاء الدورة بنجاح",

  // Search & filters
  "courses.searchPlaceholder": "ابحث عن دورة...",
  "courses.filterByStatus": "تصفية حسب الحالة",
  "courses.filterByDelivery": "تصفية حسب طريقة التقديم",
  "courses.filterByType": "تصفية حسب النوع",
  "courses.noCourses": "لا توجد دورات بعد",
  "courses.noCoursesDesc": "أنشئ دورتك الأولى للبدء",

  // Wizard steps
  "courses.wizard.step1": "المعلومات الأساسية",
  "courses.wizard.step1Desc": "الاسم والوصف وتعيين الممارس",
  "courses.wizard.step2": "الجلسات والجدولة",
  "courses.wizard.step2Desc": "عدد الجلسات والمدة والتكرار",
  "courses.wizard.step3": "التسعير والسعة",
  "courses.wizard.step3Desc": "السعر والمشاركين وطريقة التقديم",
  "courses.wizard.step4": "مراجعة وإنشاء",
  "courses.wizard.step4Desc": "مراجعة التفاصيل قبل الإنشاء",
  "courses.wizard.submit": "إنشاء الدورة",
  "courses.wizard.next": "التالي",
  "courses.wizard.back": "رجوع",

  // Form fields
  "courses.nameAr": "الاسم (عربي)",
  "courses.nameEn": "الاسم (إنجليزي)",
  "courses.descriptionAr": "الوصف (عربي)",
  "courses.descriptionEn": "الوصف (إنجليزي)",
  "courses.practitioner": "الممارس",
  "courses.department": "التخصص",
  "courses.totalSessions": "عدد الجلسات الكلي",
  "courses.durationPerSession": "مدة الجلسة (دقيقة)",
  "courses.frequency": "تكرار الجلسات",
  "courses.startDate": "تاريخ البدء",
  "courses.price": "السعر (هللة)",
  "courses.priceHint": "اتركه 0 للدورات المجانية",
  "courses.isGroup": "دورة جماعية",
  "courses.maxParticipants": "الحد الأقصى للمشاركين",
  "courses.deliveryMode": "طريقة التقديم",
  "courses.location": "الموقع",
  "courses.locationHint": "مطلوب للدورات الحضورية أو المختلطة",
  "courses.minutes": "دقيقة",
  "courses.free": "مجانية",

  // Frequency options
  "courses.frequency.weekly": "أسبوعي",
  "courses.frequency.biweekly": "كل أسبوعين",
  "courses.frequency.monthly": "شهري",

  // Delivery mode options
  "courses.deliveryMode.in_person": "حضوري",
  "courses.deliveryMode.online": "عن بُعد",
  "courses.deliveryMode.hybrid": "مختلط",

  // Status labels
  "courses.status.draft": "مسودة",
  "courses.status.published": "منشورة",
  "courses.status.in_progress": "جارية",
  "courses.status.completed": "مكتملة",
  "courses.status.archived": "مؤرشفة",

  // Table columns
  "courses.name": "اسم الدورة",
  "courses.sessions": "الجلسات",
  "courses.enrolled": "المسجلين",
  "courses.status": "الحالة",
  "courses.startDateCol": "تاريخ البدء",

  // Sessions tab
  "courses.tabs.sessions": "الجلسات",
  "courses.tabs.enrollments": "التسجيلات",
  "courses.tabs.details": "التفاصيل",
  "courses.noSessions": "لا توجد جلسات بعد",
  "courses.sessionNumber": "الجلسة رقم",
  "courses.scheduledAt": "الموعد",
  "courses.sessionStatus": "حالة الجلسة",
  "courses.sessionStatus.scheduled": "مجدولة",
  "courses.sessionStatus.completed": "مكتملة",
  "courses.sessionStatus.cancelled": "ملغاة",

  // Attendance
  "courses.markAttendance": "تسجيل الحضور",
  "courses.attendanceMarked": "تم تسجيل الحضور بنجاح",
  "courses.selectAttendees": "اختر الحاضرين",
  "courses.attendedSessions": "جلسات حضرها",

  // Enrollments tab
  "courses.addPatient": "تسجيل مستفيد",
  "courses.patientEnrolled": "تم تسجيل المستفيد بنجاح",
  "courses.dropEnrollment": "إلغاء التسجيل",
  "courses.refundEnrollment": "استرداد المبلغ",
  "courses.enrollmentDropped": "تم إلغاء التسجيل بنجاح",
  "courses.enrollmentRefunded": "تم استرداد المبلغ بنجاح",
  "courses.noEnrollments": "لا توجد تسجيلات بعد",
  "courses.noEnrollmentsDesc": "سجّل مستفيدين في هذه الدورة للبدء",
  "courses.patient": "المستفيد",
  "courses.enrollmentStatus": "حالة التسجيل",
  "courses.paymentStatus": "حالة الدفع",
  "courses.enrolledAt": "تاريخ التسجيل",
  "courses.completedAt": "تاريخ الإكمال",

  // Enrollment status labels
  "courses.enrollmentStatus.enrolled": "مسجل",
  "courses.enrollmentStatus.active": "نشط",
  "courses.enrollmentStatus.completed": "مكتمل",
  "courses.enrollmentStatus.dropped": "تم الإلغاء",
  "courses.enrollmentStatus.refunded": "مسترد",

  // Confirm dialogs
  "courses.confirmCancel": "هل أنت متأكد من إلغاء هذه الدورة؟ سيتم إسقاط جميع التسجيلات النشطة.",
  "courses.confirmDelete": "هل أنت متأكد من حذف هذه الدورة؟ لا يمكن التراجع عن هذا الإجراء.",
  "courses.confirmPublish": "هل تريد نشر هذه الدورة وإتاحتها للمستفيدين؟",
  "courses.confirmDrop": "هل أنت متأكد من إلغاء تسجيل هذا المستفيد؟",

  // Stats
  "courses.totalCourses": "إجمالي الدورات",
  "courses.activeCourses": "الدورات النشطة",
  "courses.totalEnrolled": "إجمالي المسجلين",
  "courses.completionRate": "معدل الإكمال",

  "courses.createTitle": "إضافة دورة",
}
