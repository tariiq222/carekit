-- Migration: TASK-DB-03 Class B — intra-finance FKs
-- RefundRequest.invoiceId → Invoice (RESTRICT: never silently delete an invoice under a refund)
-- RefundRequest.paymentId → Payment (RESTRICT: same rationale — financial audit record)
--
-- Zero orphans confirmed before adding these constraints (audit run 2026-05-02).

-- 1. RefundRequest.invoiceId → Invoice (ON DELETE RESTRICT)
ALTER TABLE "RefundRequest"
  ADD CONSTRAINT "RefundRequest_invoiceId_fkey"
  FOREIGN KEY ("invoiceId")
  REFERENCES "Invoice"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- 2. RefundRequest.paymentId → Payment (ON DELETE RESTRICT)
ALTER TABLE "RefundRequest"
  ADD CONSTRAINT "RefundRequest_paymentId_fkey"
  FOREIGN KEY ("paymentId")
  REFERENCES "Payment"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
