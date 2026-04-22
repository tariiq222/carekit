-- SaaS-02h: reconcile RLS GUC naming and remove silent NULL bypass.
-- Before this migration two different GUCs were referenced by policies
-- (`app.current_org_id` in 02a/b/c, `app.current_organization_id` in 02e+).
-- Neither was being set at runtime, so RLS was effectively a no-op. This
-- migration: (1) canonicalizes on `app.current_org_id`, (2) replaces the
-- silent "NULL means allow" clause with an explicit `app.is_system_bypass`
-- GUC that must be deliberately set to 'on' to bypass (webhooks, cron).

-- 1. Helper function — returns the current tenant UUID or NULL.
CREATE OR REPLACE FUNCTION app_current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_org_id', true), '')::uuid;
$$;

-- 2. Helper function — returns true only when system bypass is explicitly enabled.
CREATE OR REPLACE FUNCTION app_is_system_bypass()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('app.is_system_bypass', true), ''), 'off') = 'on';
$$;

-- 3. Transactional helpers — callable by application code via $executeRaw.
CREATE OR REPLACE FUNCTION app_set_tenant(org_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('app.current_org_id', org_id::text, true);
  PERFORM set_config('app.is_system_bypass', 'off', true);
END;
$$;

CREATE OR REPLACE FUNCTION app_enable_system_bypass()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('app.current_org_id', '', true);
  PERFORM set_config('app.is_system_bypass', 'on', true);
END;
$$;

-- 4. Drop old policies that used the wrong GUC or the silent NULL bypass.
DO $$
DECLARE
  t text;
  scoped_tables text[] := ARRAY[
    -- 02a identity
    'RefreshToken','CustomRole','Permission',
    -- 02b people
    'Client','ClientRefreshToken','Employee','EmployeeBranch','EmployeeService',
    'EmployeeAvailability','EmployeeAvailabilityException',
    -- 02c org-config + org-experience
    'Branch','Department','ServiceCategory','Service','ServiceBookingConfig',
    'ServiceDurationOption','EmployeeServiceOption','BusinessHour','Holiday',
    'BrandingConfig','IntakeForm','IntakeField','Rating','OrganizationSettings',
    -- 02d bookings
    'Booking','BookingStatusLog','WaitlistEntry','GroupSession','GroupEnrollment',
    'GroupSessionWaitlist','BookingSettings',
    -- 02e finance
    'Invoice','Payment','Coupon','CouponRedemption','RefundRequest',
    'ZatcaSubmission','ZatcaConfig',
    -- 02f comms + ai partial
    'EmailTemplate','Notification','ChatConversation','CommsChatMessage',
    'ChatSession','ChatMessage','ContactMessage','ChatbotConfig',
    -- 02g ai/media/ops/platform/content
    'KnowledgeDocument','DocumentChunk','File','ActivityLog','Report',
    'ProblemReport','Integration','FeatureFlag','SiteSetting',
    -- 02g-sms
    'OrganizationSmsConfig','SmsDelivery',
    -- post-02g
    'PasswordHistory'
  ];
BEGIN
  FOREACH t IN ARRAY scoped_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_refresh_token ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_custom_role ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_permission ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_client ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_employee ON %I', t);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I '
      'USING ("organizationId"::uuid = app_current_org_id() OR app_is_system_bypass()) '
      'WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_is_system_bypass())',
      t
    );
  END LOOP;
END $$;

-- 5. Revoke default privileges on the bypass helper — only the app role should call it.
REVOKE ALL ON FUNCTION app_enable_system_bypass() FROM PUBLIC;
