# Migration Log

> سجل جميع الـ migrations مع وصف التغييرات. يُحدّث مع كل migration جديد.

| Migration | التاريخ | الوصف |
|-----------|---------|-------|
| `20260322173113_add_practitioner_services_and_refund_amount` | 2026-03-22 | إضافة PractitionerService + refundAmount على Payment |
| `20260322224317_enrich_practitioner_service_pricing` | 2026-03-22 | إثراء أسعار PractitionerService (priceClinic/Phone/Video, buffers, availableTypes) |
| `20260322224406_make_practitioner_service_id_required` | 2026-03-22 | جعل practitionerServiceId إلزامي في Booking |
| `20260322234344_sprint_4_6_audit_hardening` | 2026-03-22 | Sprint 4.6: تقوية الأمان + ActivityLog + Notification + FcmToken |
| `20260323004329_add_reschedule_chain_no_show_readat_permission_ar` | 2026-03-23 | إضافة rescheduledFromId (سلسلة إعادة الجدولة) + no_show status + readAt على Notification + descriptionAr على Permission |
