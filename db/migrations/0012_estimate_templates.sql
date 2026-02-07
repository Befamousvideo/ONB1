-- 0012_estimate_templates.sql
-- Store estimate templates

BEGIN;

CREATE TABLE estimate_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  line_items jsonb NOT NULL,
  min_total_cents bigint NOT NULL,
  max_total_cents bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO estimate_templates (name, description, line_items, min_total_cents, max_total_cents)
VALUES (
  'Bug Fix',
  'Standard bug fix triage and patch',
  '[{"label":"Triage","min_cents":20000,"max_cents":40000},{"label":"Fix","min_cents":60000,"max_cents":120000}]'::jsonb,
  80000,
  160000
),
(
  'Change Request',
  'Enhancement to existing workflow',
  '[{"label":"Discovery","min_cents":30000,"max_cents":60000},{"label":"Implementation","min_cents":90000,"max_cents":180000}]'::jsonb,
  120000,
  240000
),
(
  'New Feature',
  'Net-new feature build',
  '[{"label":"Scoping","min_cents":40000,"max_cents":80000},{"label":"Build","min_cents":150000,"max_cents":300000}]'::jsonb,
  190000,
  380000
);

COMMIT;
