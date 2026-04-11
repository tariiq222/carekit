-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "booking_type" AS ENUM ('clinic_visit', 'phone_consultation', 'video_consultation', 'walk_in');

-- CreateEnum
CREATE TYPE "booking_status" AS ENUM ('pending', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'pending_cancellation', 'no_show', 'expired');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('moyasar', 'bank_transfer');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('pending', 'awaiting', 'paid', 'refunded', 'failed', 'rejected');

-- CreateEnum
CREATE TYPE "transfer_verification_status" AS ENUM ('pending', 'matched', 'amount_differs', 'suspicious', 'old_date', 'unreadable', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('booking_confirmed', 'booking_completed', 'booking_cancelled', 'booking_rescheduled', 'booking_expired', 'booking_no_show', 'booking_reminder', 'booking_reminder_urgent', 'booking_cancellation_rejected', 'cancellation_rejected', 'cancellation_requested', 'no_show_review', 'patient_arrived', 'receipt_rejected', 'reminder', 'payment_received', 'new_rating', 'problem_report', 'waitlist_slot_available', 'system_alert');

-- CreateEnum
CREATE TYPE "waitlist_status" AS ENUM ('waiting', 'notified', 'booked', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "problem_report_type" AS ENUM ('wait_time', 'staff_behavior', 'cleanliness', 'billing', 'no_call', 'late', 'technical', 'other');

-- CreateEnum
CREATE TYPE "problem_report_status" AS ENUM ('open', 'in_review', 'resolved', 'dismissed');

-- CreateEnum
CREATE TYPE "chat_role" AS ENUM ('user', 'assistant', 'system', 'staff');

-- CreateEnum
CREATE TYPE "handoff_type" AS ENUM ('live_chat', 'contact_number');

-- CreateEnum
CREATE TYPE "config_value_type" AS ENUM ('string', 'json', 'file');

-- CreateEnum
CREATE TYPE "user_gender" AS ENUM ('male', 'female');

-- CreateEnum
CREATE TYPE "zatca_status" AS ENUM ('not_applicable', 'pending', 'reported', 'failed');

-- CreateEnum
CREATE TYPE "otp_type" AS ENUM ('login', 'reset_password', 'verify_email');

-- CreateEnum
CREATE TYPE "kb_file_status" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "device_platform" AS ENUM ('ios', 'android');

-- CreateEnum
CREATE TYPE "recurring_pattern" AS ENUM ('daily', 'every_2_days', 'every_3_days', 'weekly', 'biweekly', 'monthly');

-- CreateEnum
CREATE TYPE "session_language" AS ENUM ('ar', 'en');

-- CreateEnum
CREATE TYPE "account_type" AS ENUM ('FULL', 'WALK_IN');

-- CreateEnum
CREATE TYPE "blood_type" AS ENUM ('A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "form_scope" AS ENUM ('global', 'service', 'practitioner', 'branch');

-- CreateEnum
CREATE TYPE "form_type" AS ENUM ('pre_booking', 'pre_session', 'post_session', 'registration');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "first_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "last_name" TEXT NOT NULL,
    "phone" TEXT,
    "gender" "user_gender",
    "avatar_url" TEXT,
    "account_type" "account_type" NOT NULL DEFAULT 'FULL',
    "claimed_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "national_id" TEXT,
    "nationality" TEXT,
    "date_of_birth" TIMESTAMP(3),
    "emergency_name" TEXT,
    "emergency_phone" TEXT,
    "blood_type" "blood_type",
    "allergies" TEXT,
    "chronic_conditions" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "otp_type" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "description_ar" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practitioners" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT,
    "name_ar" TEXT,
    "specialty" TEXT NOT NULL DEFAULT '',
    "specialty_ar" TEXT NOT NULL DEFAULT '',
    "bio" TEXT,
    "bio_ar" TEXT,
    "experience" INTEGER NOT NULL DEFAULT 0,
    "education" TEXT,
    "education_ar" TEXT,
    "price_clinic" INTEGER NOT NULL DEFAULT 0,
    "price_phone" INTEGER NOT NULL DEFAULT 0,
    "price_video" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_accepting_bookings" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "practitioners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practitioner_availabilities" (
    "id" TEXT NOT NULL,
    "practitioner_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practitioner_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practitioner_vacations" (
    "id" TEXT NOT NULL,
    "practitioner_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practitioner_vacations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practitioner_breaks" (
    "id" TEXT NOT NULL,
    "practitioner_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practitioner_breaks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practitioner_services" (
    "id" TEXT NOT NULL,
    "practitioner_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "price_clinic" INTEGER,
    "price_phone" INTEGER,
    "price_video" INTEGER,
    "custom_duration" INTEGER,
    "buffer_minutes" INTEGER NOT NULL DEFAULT 0,
    "available_types" "booking_type"[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practitioner_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_categories" (
    "id" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "description_ar" TEXT,
    "description_en" TEXT,
    "category_id" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "duration" INTEGER NOT NULL DEFAULT 30,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "hide_price_on_booking" BOOLEAN NOT NULL DEFAULT false,
    "hide_duration_on_booking" BOOLEAN NOT NULL DEFAULT false,
    "calendar_color" TEXT,
    "buffer_minutes" INTEGER NOT NULL DEFAULT 0,
    "deposit_enabled" BOOLEAN NOT NULL DEFAULT false,
    "deposit_percent" INTEGER NOT NULL DEFAULT 100,
    "allow_recurring" BOOLEAN NOT NULL DEFAULT true,
    "allowed_recurring_patterns" "recurring_pattern"[] DEFAULT ARRAY[]::"recurring_pattern"[],
    "max_recurrences" INTEGER NOT NULL DEFAULT 12,
    "max_participants" INTEGER NOT NULL DEFAULT 1,
    "min_lead_minutes" INTEGER,
    "max_advance_days" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_duration_options" (
    "id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "service_booking_type_id" TEXT,
    "label" TEXT NOT NULL,
    "label_ar" TEXT,
    "duration_minutes" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "service_duration_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_booking_types" (
    "id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "booking_type" "booking_type" NOT NULL,
    "price" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_booking_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practitioner_service_types" (
    "id" TEXT NOT NULL,
    "practitioner_service_id" TEXT NOT NULL,
    "booking_type" "booking_type" NOT NULL,
    "price" INTEGER,
    "duration" INTEGER,
    "use_custom_options" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practitioner_service_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practitioner_duration_options" (
    "id" TEXT NOT NULL,
    "practitioner_service_type_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "label_ar" TEXT,
    "duration_minutes" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "practitioner_duration_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_forms" (
    "id" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "type" "form_type" NOT NULL,
    "scope" "form_scope" NOT NULL,
    "service_id" TEXT,
    "practitioner_id" TEXT,
    "branch_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "submissions_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intake_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_fields" (
    "id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "label_ar" TEXT NOT NULL,
    "label_en" TEXT NOT NULL,
    "field_type" TEXT NOT NULL,
    "options" JSONB,
    "condition" JSONB,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "intake_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_responses" (
    "id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intake_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT,
    "practitioner_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "practitioner_service_id" TEXT NOT NULL,
    "type" "booking_type" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "status" "booking_status" NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "zoom_meeting_id" TEXT,
    "zoom_join_url" TEXT,
    "zoom_host_url" TEXT,
    "cancellation_reason" TEXT,
    "admin_notes" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "rescheduled_from_id" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "cancelled_by" TEXT,
    "no_show_at" TIMESTAMP(3),
    "checked_in_at" TIMESTAMP(3),
    "in_progress_at" TIMESTAMP(3),
    "completion_notes" TEXT,
    "is_walk_in" BOOLEAN NOT NULL DEFAULT false,
    "recurring_group_id" TEXT,
    "recurring_pattern" "recurring_pattern",
    "reschedule_count" INTEGER NOT NULL DEFAULT 0,
    "suggested_refund_type" TEXT,
    "duration_option_id" TEXT,
    "booked_price" INTEGER,
    "booked_duration" INTEGER,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_settings" (
    "id" TEXT NOT NULL,
    "payment_timeout_minutes" INTEGER NOT NULL DEFAULT 60,
    "free_cancel_before_hours" INTEGER NOT NULL DEFAULT 24,
    "free_cancel_refund_type" TEXT NOT NULL DEFAULT 'full',
    "late_cancel_refund_type" TEXT NOT NULL DEFAULT 'none',
    "late_cancel_refund_percent" INTEGER NOT NULL DEFAULT 0,
    "admin_can_direct_cancel" BOOLEAN NOT NULL DEFAULT true,
    "patient_can_cancel_pending" BOOLEAN NOT NULL DEFAULT true,
    "patient_can_reschedule" BOOLEAN NOT NULL DEFAULT true,
    "reschedule_before_hours" INTEGER NOT NULL DEFAULT 12,
    "max_reschedules_per_booking" INTEGER NOT NULL DEFAULT 2,
    "allow_walk_in" BOOLEAN NOT NULL DEFAULT true,
    "walk_in_payment_required" BOOLEAN NOT NULL DEFAULT false,
    "allow_recurring" BOOLEAN NOT NULL DEFAULT false,
    "max_recurrences" INTEGER NOT NULL DEFAULT 12,
    "allowed_recurring_patterns" "recurring_pattern"[] DEFAULT ARRAY['weekly', 'biweekly']::"recurring_pattern"[],
    "waitlist_enabled" BOOLEAN NOT NULL DEFAULT false,
    "waitlist_max_per_slot" INTEGER NOT NULL DEFAULT 5,
    "waitlist_auto_notify" BOOLEAN NOT NULL DEFAULT true,
    "buffer_minutes" INTEGER NOT NULL DEFAULT 0,
    "auto_complete_after_hours" INTEGER NOT NULL DEFAULT 2,
    "auto_no_show_after_minutes" INTEGER NOT NULL DEFAULT 30,
    "no_show_policy" TEXT NOT NULL DEFAULT 'keep_full',
    "no_show_refund_percent" INTEGER NOT NULL DEFAULT 0,
    "cancellation_review_timeout_hours" INTEGER NOT NULL DEFAULT 48,
    "cancellation_policy_en" TEXT NOT NULL DEFAULT '',
    "cancellation_policy_ar" TEXT NOT NULL DEFAULT '',
    "reminder_24h_enabled" BOOLEAN NOT NULL DEFAULT true,
    "reminder_1h_enabled" BOOLEAN NOT NULL DEFAULT true,
    "reminder_interactive" BOOLEAN NOT NULL DEFAULT false,
    "suggest_alternatives_on_conflict" BOOLEAN NOT NULL DEFAULT true,
    "suggest_alternatives_count" INTEGER NOT NULL DEFAULT 3,
    "min_booking_lead_minutes" INTEGER NOT NULL DEFAULT 0,
    "admin_can_book_outside_hours" BOOLEAN NOT NULL DEFAULT false,
    "max_advance_booking_days" INTEGER NOT NULL DEFAULT 60,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waitlist_entries" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "practitioner_id" TEXT NOT NULL,
    "service_id" TEXT,
    "preferred_date" TIMESTAMP(3),
    "preferred_time" TEXT,
    "status" "waitlist_status" NOT NULL DEFAULT 'waiting',
    "notified_at" TIMESTAMP(3),
    "booked_booking_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorite_practitioners" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "practitioner_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_practitioners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "vat_amount" INTEGER NOT NULL DEFAULT 0,
    "total_amount" INTEGER NOT NULL DEFAULT 0,
    "refund_amount" INTEGER,
    "method" "payment_method" NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'pending',
    "moyasar_payment_id" TEXT,
    "transaction_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transfer_receipts" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "receipt_url" TEXT NOT NULL,
    "ai_verification_status" "transfer_verification_status" NOT NULL DEFAULT 'pending',
    "ai_confidence" DOUBLE PRECISION,
    "ai_notes" TEXT,
    "extracted_amount" INTEGER,
    "extracted_date" TIMESTAMP(3),
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "admin_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "bank_transfer_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "pdf_url" TEXT,
    "sent_at" TIMESTAMP(3),
    "vat_amount" INTEGER NOT NULL DEFAULT 0,
    "vat_rate" INTEGER NOT NULL DEFAULT 0,
    "invoice_hash" TEXT,
    "previous_hash" TEXT,
    "qr_code_data" TEXT,
    "zatca_status" "zatca_status" NOT NULL DEFAULT 'not_applicable',
    "zatca_response" JSONB,
    "xml_content" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_webhooks" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ratings" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "patient_id" TEXT,
    "practitioner_id" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problem_reports" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "patient_id" TEXT,
    "type" "problem_report_type" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "problem_report_status" NOT NULL DEFAULT 'open',
    "admin_notes" TEXT,
    "resolved_by_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "problem_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "handed_off" BOOLEAN NOT NULL DEFAULT false,
    "handoff_type" "handoff_type",
    "language" "session_language",
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "role" "chat_role" NOT NULL,
    "content" TEXT NOT NULL,
    "function_call" JSONB,
    "intent" TEXT,
    "tool_name" TEXT,
    "token_count" INTEGER,
    "staff_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_base" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "category" TEXT,
    "source" TEXT,
    "file_id" TEXT,
    "chunk_index" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_base_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chatbot_config" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "category" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chatbot_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_base_files" (
    "id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "chunks_count" INTEGER NOT NULL DEFAULT 0,
    "status" "kb_file_status" NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_base_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "white_label_config" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" "config_value_type" NOT NULL DEFAULT 'string',
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "white_label_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_status_logs" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "changed_by" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "resource_id" TEXT,
    "description" TEXT,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title_ar" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "body_ar" TEXT NOT NULL,
    "body_en" TEXT NOT NULL,
    "type" "notification_type" NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fcm_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "device_platform" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fcm_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_working_hours" (
    "id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinic_working_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_holidays" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinic_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description_ar" TEXT,
    "description_en" TEXT,
    "discount_type" TEXT NOT NULL,
    "discount_value" INTEGER NOT NULL,
    "min_amount" INTEGER NOT NULL DEFAULT 0,
    "max_uses" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "max_uses_per_user" INTEGER,
    "service_ids" TEXT[],
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_redemptions" (
    "id" TEXT NOT NULL,
    "coupon_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "booking_id" TEXT,
    "amount" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "is_main" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Riyadh',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practitioner_branches" (
    "id" TEXT NOT NULL,
    "practitioner_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practitioner_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_cards" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "initial_amount" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "purchased_by" TEXT,
    "redeemed_by" TEXT,
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gift_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_card_transactions" (
    "id" TEXT NOT NULL,
    "gift_card_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "booking_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gift_card_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "subject_ar" TEXT NOT NULL,
    "subject_en" TEXT NOT NULL,
    "body_ar" TEXT NOT NULL,
    "body_en" TEXT NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "patient_profiles_user_id_key" ON "patient_profiles"("user_id");

-- CreateIndex
CREATE INDEX "otp_codes_user_id_type_used_at_idx" ON "otp_codes"("user_id", "type", "used_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "roles_slug_key" ON "roles"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_module_action_key" ON "permissions"("module", "action");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_key" ON "user_roles"("user_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "practitioners_user_id_key" ON "practitioners"("user_id");

-- CreateIndex
CREATE INDEX "practitioners_is_active_deleted_at_idx" ON "practitioners"("is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "practitioner_availabilities_practitioner_id_day_of_week_is__idx" ON "practitioner_availabilities"("practitioner_id", "day_of_week", "is_active");

-- CreateIndex
CREATE INDEX "practitioner_vacations_practitioner_id_idx" ON "practitioner_vacations"("practitioner_id");

-- CreateIndex
CREATE INDEX "practitioner_breaks_practitioner_id_day_of_week_idx" ON "practitioner_breaks"("practitioner_id", "day_of_week");

-- CreateIndex
CREATE INDEX "practitioner_services_service_id_idx" ON "practitioner_services"("service_id");

-- CreateIndex
CREATE UNIQUE INDEX "practitioner_services_practitioner_id_service_id_key" ON "practitioner_services"("practitioner_id", "service_id");

-- CreateIndex
CREATE INDEX "services_category_id_idx" ON "services"("category_id");

-- CreateIndex
CREATE INDEX "service_duration_options_service_id_idx" ON "service_duration_options"("service_id");

-- CreateIndex
CREATE INDEX "service_duration_options_service_booking_type_id_idx" ON "service_duration_options"("service_booking_type_id");

-- CreateIndex
CREATE INDEX "service_booking_types_service_id_idx" ON "service_booking_types"("service_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_booking_types_service_id_booking_type_key" ON "service_booking_types"("service_id", "booking_type");

-- CreateIndex
CREATE INDEX "practitioner_service_types_practitioner_service_id_idx" ON "practitioner_service_types"("practitioner_service_id");

-- CreateIndex
CREATE UNIQUE INDEX "practitioner_service_types_practitioner_service_id_booking__key" ON "practitioner_service_types"("practitioner_service_id", "booking_type");

-- CreateIndex
CREATE INDEX "practitioner_duration_options_practitioner_service_type_id_idx" ON "practitioner_duration_options"("practitioner_service_type_id");

-- CreateIndex
CREATE INDEX "intake_forms_scope_idx" ON "intake_forms"("scope");

-- CreateIndex
CREATE INDEX "intake_forms_service_id_idx" ON "intake_forms"("service_id");

-- CreateIndex
CREATE INDEX "intake_forms_practitioner_id_idx" ON "intake_forms"("practitioner_id");

-- CreateIndex
CREATE INDEX "intake_forms_branch_id_idx" ON "intake_forms"("branch_id");

-- CreateIndex
CREATE INDEX "intake_fields_form_id_idx" ON "intake_fields"("form_id");

-- CreateIndex
CREATE INDEX "intake_responses_form_id_idx" ON "intake_responses"("form_id");

-- CreateIndex
CREATE INDEX "intake_responses_booking_id_idx" ON "intake_responses"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_rescheduled_from_id_key" ON "bookings"("rescheduled_from_id");

-- CreateIndex
CREATE INDEX "bookings_practitioner_id_date_idx" ON "bookings"("practitioner_id", "date");

-- CreateIndex
CREATE INDEX "bookings_patient_id_status_idx" ON "bookings"("patient_id", "status");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- CreateIndex
CREATE INDEX "bookings_practitioner_service_id_idx" ON "bookings"("practitioner_service_id");

-- CreateIndex
CREATE INDEX "bookings_date_idx" ON "bookings"("date");

-- CreateIndex
CREATE INDEX "bookings_recurring_group_id_idx" ON "bookings"("recurring_group_id");

-- CreateIndex
CREATE INDEX "waitlist_entries_practitioner_id_status_idx" ON "waitlist_entries"("practitioner_id", "status");

-- CreateIndex
CREATE INDEX "waitlist_entries_patient_id_idx" ON "waitlist_entries"("patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorite_practitioners_patient_id_practitioner_id_key" ON "favorite_practitioners"("patient_id", "practitioner_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_booking_id_key" ON "payments"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_moyasar_payment_id_key" ON "payments"("moyasar_payment_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_created_at_idx" ON "payments"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "bank_transfer_receipts_payment_id_key" ON "bank_transfer_receipts"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_payment_id_key" ON "invoices"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "processed_webhooks_event_id_key" ON "processed_webhooks"("event_id");

-- CreateIndex
CREATE INDEX "processed_webhooks_processed_at_idx" ON "processed_webhooks"("processed_at");

-- CreateIndex
CREATE UNIQUE INDEX "ratings_booking_id_key" ON "ratings"("booking_id");

-- CreateIndex
CREATE INDEX "ratings_practitioner_id_idx" ON "ratings"("practitioner_id");

-- CreateIndex
CREATE INDEX "problem_reports_booking_id_idx" ON "problem_reports"("booking_id");

-- CreateIndex
CREATE INDEX "problem_reports_patient_id_idx" ON "problem_reports"("patient_id");

-- CreateIndex
CREATE INDEX "problem_reports_status_idx" ON "problem_reports"("status");

-- CreateIndex
CREATE INDEX "chat_sessions_user_id_idx" ON "chat_sessions"("user_id");

-- CreateIndex
CREATE INDEX "chat_messages_session_id_idx" ON "chat_messages"("session_id");

-- CreateIndex
CREATE INDEX "knowledge_base_source_idx" ON "knowledge_base"("source");

-- CreateIndex
CREATE INDEX "knowledge_base_file_id_idx" ON "knowledge_base"("file_id");

-- CreateIndex
CREATE UNIQUE INDEX "chatbot_config_key_key" ON "chatbot_config"("key");

-- CreateIndex
CREATE INDEX "chatbot_config_category_idx" ON "chatbot_config"("category");

-- CreateIndex
CREATE UNIQUE INDEX "white_label_config_key_key" ON "white_label_config"("key");

-- CreateIndex
CREATE INDEX "booking_status_logs_booking_id_idx" ON "booking_status_logs"("booking_id");

-- CreateIndex
CREATE INDEX "booking_status_logs_created_at_idx" ON "booking_status_logs"("created_at");

-- CreateIndex
CREATE INDEX "activity_logs_user_id_idx" ON "activity_logs"("user_id");

-- CreateIndex
CREATE INDEX "activity_logs_module_idx" ON "activity_logs"("module");

-- CreateIndex
CREATE INDEX "activity_logs_action_idx" ON "activity_logs"("action");

-- CreateIndex
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs"("created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "fcm_tokens_user_id_idx" ON "fcm_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "fcm_tokens_user_id_token_key" ON "fcm_tokens"("user_id", "token");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_working_hours_day_of_week_key" ON "clinic_working_hours"("day_of_week");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_holidays_date_key" ON "clinic_holidays"("date");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupon_redemptions_coupon_id_idx" ON "coupon_redemptions"("coupon_id");

-- CreateIndex
CREATE INDEX "coupon_redemptions_user_id_idx" ON "coupon_redemptions"("user_id");

-- CreateIndex
CREATE INDEX "practitioner_branches_branch_id_idx" ON "practitioner_branches"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "practitioner_branches_practitioner_id_branch_id_key" ON "practitioner_branches"("practitioner_id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "gift_cards_code_key" ON "gift_cards"("code");

-- CreateIndex
CREATE INDEX "gift_card_transactions_gift_card_id_idx" ON "gift_card_transactions"("gift_card_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_slug_key" ON "email_templates"("slug");

-- AddForeignKey
ALTER TABLE "patient_profiles" ADD CONSTRAINT "patient_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practitioners" ADD CONSTRAINT "practitioners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practitioner_availabilities" ADD CONSTRAINT "practitioner_availabilities_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practitioner_vacations" ADD CONSTRAINT "practitioner_vacations_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practitioner_breaks" ADD CONSTRAINT "practitioner_breaks_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practitioner_services" ADD CONSTRAINT "practitioner_services_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practitioner_services" ADD CONSTRAINT "practitioner_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_duration_options" ADD CONSTRAINT "service_duration_options_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_duration_options" ADD CONSTRAINT "service_duration_options_service_booking_type_id_fkey" FOREIGN KEY ("service_booking_type_id") REFERENCES "service_booking_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_booking_types" ADD CONSTRAINT "service_booking_types_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practitioner_service_types" ADD CONSTRAINT "practitioner_service_types_practitioner_service_id_fkey" FOREIGN KEY ("practitioner_service_id") REFERENCES "practitioner_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practitioner_duration_options" ADD CONSTRAINT "practitioner_duration_options_practitioner_service_type_id_fkey" FOREIGN KEY ("practitioner_service_type_id") REFERENCES "practitioner_service_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_forms" ADD CONSTRAINT "intake_forms_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_forms" ADD CONSTRAINT "intake_forms_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_forms" ADD CONSTRAINT "intake_forms_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_fields" ADD CONSTRAINT "intake_fields_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "intake_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_responses" ADD CONSTRAINT "intake_responses_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "intake_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_practitioner_service_id_fkey" FOREIGN KEY ("practitioner_service_id") REFERENCES "practitioner_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_rescheduled_from_id_fkey" FOREIGN KEY ("rescheduled_from_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_practitioners" ADD CONSTRAINT "favorite_practitioners_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_practitioners" ADD CONSTRAINT "favorite_practitioners_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transfer_receipts" ADD CONSTRAINT "bank_transfer_receipts_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transfer_receipts" ADD CONSTRAINT "bank_transfer_receipts_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_reports" ADD CONSTRAINT "problem_reports_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_reports" ADD CONSTRAINT "problem_reports_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_reports" ADD CONSTRAINT "problem_reports_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_base_files" ADD CONSTRAINT "knowledge_base_files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_logs" ADD CONSTRAINT "booking_status_logs_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fcm_tokens" ADD CONSTRAINT "fcm_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practitioner_branches" ADD CONSTRAINT "practitioner_branches_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practitioner_branches" ADD CONSTRAINT "practitioner_branches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_card_transactions" ADD CONSTRAINT "gift_card_transactions_gift_card_id_fkey" FOREIGN KEY ("gift_card_id") REFERENCES "gift_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
