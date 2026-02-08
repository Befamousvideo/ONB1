-- 0013_stripe_billing.sql
-- Add Stripe billing fields

BEGIN;

ALTER TABLE accounts
  ADD COLUMN stripe_customer_id text;

ALTER TABLE invoices
  ADD COLUMN provider text,
  ADD COLUMN provider_invoice_id text,
  ADD COLUMN provider_invoice_url text;

COMMIT;
