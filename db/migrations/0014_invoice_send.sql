-- 0014_invoice_send.sql
-- Track invoice send events

BEGIN;

ALTER TABLE invoices
  ADD COLUMN sent_at timestamptz;

COMMIT;
