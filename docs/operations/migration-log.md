# Migration Log

> سجل جميع الـ migrations مع وصف التغييرات. يُحدّث مع كل migration جديد.

| Migration | التاريخ | الوصف |
|-----------|---------|-------|
| `20260322173113_add_employee_services_and_refund_amount` | 2026-03-22 | إضافة EmployeeService + refundAmount على Payment |
| `20260322224317_enrich_employee_service_pricing` | 2026-03-22 | إثراء أسعار EmployeeService (priceClinic/Phone/Video, buffers, availableTypes) |
| `20260322224406_make_employee_service_id_required` | 2026-03-22 | جعل employeeServiceId إلزامي في Booking |
| `20260322234344_sprint_4_6_audit_hardening` | 2026-03-22 | Sprint 4.6: تقوية الأمان + ActivityLog + Notification + FcmToken |
| `20260323004329_add_reschedule_chain_no_show_readat_permission_ar` | 2026-03-23 | إضافة rescheduledFromId (سلسلة إعادة الجدولة) + no_show status + readAt على Notification + descriptionAr على Permission |
| `20260323120841_audit_round2_schema_fixes` | 2026-03-23 | تحويل أعمدة String إلى enums (OtpType, KbFileStatus, DevicePlatform, SessionLanguage) + unique على moyasarPaymentId + soft delete للنماذج المالية + فهارس إضافية |
| `20260324000000_add_hnsw_index_to_knowledge_base` | 2026-03-24 | إضافة فهرس HNSW على knowledge_base.embedding لتسريع بحث التشابه (cosine similarity) عبر pgvector |
| `20260324010000_add_payment_created_at_and_pgvector_indexes` | 2026-03-24 | إضافة فهرس على payments.created_at + فهرس HNSW على knowledge_base.embedding |
| `20260324020000_add_problem_reports_enhancements` | 2026-03-24 | إضافة قيم جديدة لـ problem_report_type و problem_report_status + عمود admin_notes + فهرس client_id |
| `20260410120000_add_courses_module` | 2026-04-10 | إضافة وحدة الدورات التدريبية: نماذج Course + CourseSession + CourseEnrollment + CoursePayment + enums CourseStatus/CourseSessionStatus/CourseEnrollmentStatus/CourseFrequency/DeliveryMode + إضافة courses كـ FeatureFlag + Permission — تطبيق بـ migrate diff بسبب shadow DB |
| `20260324100000_add_booking_settings_and_enhancements` | 2026-03-24 | Booking System Overhaul: BookingSettings, WaitlistEntry, FavoriteEmployee + أعمدة جديدة على Booking (cancelledBy, checkedInAt, inProgressAt, completionNotes, isWalkIn, recurringGroupId, rescheduleCount) + enum updates (walk_in, checked_in, in_progress, expired, awaiting, waitlist_status) |
| `20260410210000_merge_courses_into_groups_rename_group_sessions` | 2026-04-10 | دمج وحدتي group-sessions وcourses في وحدة واحدة groups: إعادة تسمية GroupSession→Group (جدول group_sessions→groups)، إعادة تسمية group_session_id→group_id، حذف depositPercent واستبداله بـ paymentType+depositAmount، إضافة GroupPayment وGroupCertificate، إعادة تسمية enums (GroupSessionSchedulingMode→GroupSchedulingMode، GroupSessionStatus→GroupStatus)، إضافة GroupPaymentType، حذف Course* tables وenums بالكامل، دمج مفتاح license hasGroupSessions+hasCourses→hasGroups، دمج feature_flags: group_sessions+courses→groups، دمج permissions: group_sessions+courses→groups. Rollback: prisma migrate reset (DEV فقط — يحذف كل البيانات) |
| `20260410230000_add_fk_booking_service_duration_option` | 2026-04-10 | إضافة حقل service_duration_option_id على جدول bookings مع FK → service_duration_options (onDelete: SetNull). يحل مشكلة orphan IDs عند حذف ServiceDurationOption records في setBookingTypes(). Rollback: `ALTER TABLE bookings DROP CONSTRAINT bookings_service_duration_option_id_fkey; ALTER TABLE bookings DROP COLUMN service_duration_option_id;` |
