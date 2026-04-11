-- AddUniqueConstraint: Payment.groupEnrollmentId
-- One payment per group enrollment — prevents duplicate payments for the same enrollment.
ALTER TABLE "payments" ADD CONSTRAINT "payments_group_enrollment_id_key" UNIQUE ("group_enrollment_id");
