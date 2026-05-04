import type { Pool } from 'pg';

export const PLAN_SEED_SQL = `
      INSERT INTO "Plan" (id, slug, "nameAr", "nameEn", "priceMonthly", "priceAnnual", currency, limits, "isActive", "sortOrder", "isVisible", "createdAt", "updatedAt")
      VALUES
        ('b1a51c00-0000-4000-8000-000000000001', 'BASIC', 'الأساسية', 'Basic', 299, 2999, 'SAR',
         '{"maxBranches":1,"maxEmployees":5,"maxServices":-1,"maxBookingsPerMonth":500,"maxClients":-1,"overageRateBookings":0.5,"overageRateClients":0.1,"recurring_bookings":false,"waitlist":false,"group_sessions":false,"ai_chatbot":false,"email_templates":true,"coupons":false,"advanced_reports":false,"intake_forms":false,"custom_roles":false,"activity_log":false,"zoom_integration":false,"walk_in_bookings":false,"bank_transfer_payments":false,"multi_branch":false,"departments":false,"client_ratings":false,"data_export":false,"sms_provider_per_tenant":false,"white_label_mobile":false,"custom_domain":false,"api_access":false,"webhooks":false,"priority_support":false,"audit_export":false,"multi_currency":false,"email_fallback_monthly":500,"sms_fallback_monthly":100}'::jsonb,
         true, 10, true, NOW(), NOW()),
        ('b1a51c00-0000-4000-8000-000000000002', 'PRO', 'الاحترافية', 'Professional', 799, 7999, 'SAR',
         '{"maxBranches":3,"maxEmployees":15,"maxServices":-1,"maxBookingsPerMonth":2000,"maxClients":-1,"overageRateBookings":0.5,"overageRateClients":0.1,"recurring_bookings":true,"waitlist":true,"group_sessions":false,"ai_chatbot":true,"email_templates":true,"coupons":true,"advanced_reports":false,"intake_forms":false,"custom_roles":false,"activity_log":false,"zoom_integration":true,"walk_in_bookings":true,"bank_transfer_payments":true,"multi_branch":true,"departments":true,"client_ratings":true,"data_export":false,"sms_provider_per_tenant":false,"white_label_mobile":false,"custom_domain":false,"api_access":false,"webhooks":false,"priority_support":false,"audit_export":false,"multi_currency":false,"email_fallback_monthly":500,"sms_fallback_monthly":100}'::jsonb,
         true, 20, true, NOW(), NOW()),
        ('b1a51c00-0000-4000-8000-000000000003', 'ENTERPRISE', 'المؤسسية', 'Enterprise', 1999, 19999, 'SAR',
         '{"maxBranches":-1,"maxEmployees":-1,"maxServices":-1,"maxBookingsPerMonth":-1,"maxClients":-1,"overageRateBookings":0,"overageRateClients":0,"recurring_bookings":true,"waitlist":true,"group_sessions":true,"ai_chatbot":true,"email_templates":true,"coupons":true,"advanced_reports":true,"intake_forms":true,"custom_roles":true,"activity_log":true,"zoom_integration":true,"walk_in_bookings":true,"bank_transfer_payments":true,"multi_branch":true,"departments":true,"client_ratings":true,"data_export":true,"sms_provider_per_tenant":true,"white_label_mobile":true,"custom_domain":true,"api_access":true,"webhooks":true,"priority_support":true,"audit_export":true,"multi_currency":true,"email_fallback_monthly":-1,"sms_fallback_monthly":-1}'::jsonb,
         true, 30, true, NOW(), NOW())
      ON CONFLICT (slug) DO UPDATE SET limits = EXCLUDED.limits, "updatedAt" = NOW()
`;

export async function seedPlatformPlans(pool: Pool): Promise<void> {
  await pool.query(PLAN_SEED_SQL);
}
