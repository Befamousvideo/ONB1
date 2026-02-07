-- 0010_project_metadata.sql
-- Add metadata to projects for integrations and SLA

BEGIN;

ALTER TABLE projects
  ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE projects
   SET metadata = jsonb_build_object(
     'integrations', jsonb_build_array('slack', 'email'),
     'sla_same_day', false
   )
 WHERE name = 'Demo Project';

COMMIT;
