# Migration Log

> سجل جميع الـ migrations مع وصف التغييرات. يُحدّث مع كل migration جديد.

| Migration | التاريخ | الوصف |
|-----------|---------|-------|
| `20260322173113_add_practitioner_services_and_refund_amount` | 2026-03-22 | إضافة PractitionerService + refundAmount على Payment |
| `20260322224317_enrich_practitioner_service_pricing` | 2026-03-22 | إثراء أسعار PractitionerService (priceClinic/Phone/Video, buffers, availableTypes) |
| `20260322224406_make_practitioner_service_id_required` | 2026-03-22 | جعل practitionerServiceId إلزامي في Booking |
| `20260322234344_sprint_4_6_audit_hardening` | 2026-03-22 | Sprint 4.6: تقوية الأمان + ActivityLog + Notification + FcmToken |
| `20260323004329_add_reschedule_chain_no_show_readat_permission_ar` | 2026-03-23 | إضافة rescheduledFromId (سلسلة إعادة الجدولة) + no_show status + readAt على Notification + descriptionAr على Permission |
| `20260323120841_audit_round2_schema_fixes` | 2026-03-23 | تحويل أعمدة String إلى enums (OtpType, KbFileStatus, DevicePlatform, SessionLanguage) + unique على moyasarPaymentId + soft delete للنماذج المالية + فهارس إضافية |
| `20260324000000_add_hnsw_index_to_knowledge_base` | 2026-03-24 | إضافة فهرس HNSW على knowledge_base.embedding لتسريع بحث التشابه (cosine similarity) عبر pgvector |
| `20260324010000_add_payment_created_at_and_pgvector_indexes` | 2026-03-24 | إضافة فهرس على payments.created_at + فهرس HNSW على knowledge_base.embedding |
| `20260324020000_add_problem_reports_enhancements` | 2026-03-24 | إضافة قيم جديدة لـ problem_report_type و problem_report_status + عمود admin_notes + فهرس patient_id |
| `20260410120000_add_courses_module` | 2026-04-10 | إضافة وحدة الدورات التدريبية: نماذج Course + CourseSession + CourseEnrollment + CoursePayment + enums CourseStatus/CourseSessionStatus/CourseEnrollmentStatus/CourseFrequency/DeliveryMode + إضافة courses كـ FeatureFlag + Permission — تطبيق بـ migrate diff بسبب shadow DB |
| `20260324100000_add_booking_settings_and_enhancements` | 2026-03-24 | Booking System Overhaul: BookingSettings, WaitlistEntry, FavoritePractitioner + أعمدة جديدة على Booking (cancelledBy, checkedInAt, inProgressAt, completionNotes, isWalkIn, recurringGroupId, rescheduleCount) + enum updates (walk_in, checked_in, in_progress, expired, awaiting, waitlist_status) |
