-- 0011_request_addon.sql
-- Add add-on flagging fields to requests

BEGIN;

ALTER TABLE requests
  ADD COLUMN addon_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN addon_rationale text;

COMMIT;
