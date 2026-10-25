-- =====================================================================
-- Roles: owner/admin/operator/viewer -> owner ("Dueño") / user ("Usuario")
-- Solo para bases creadas antes del cambio (schema.sql ya lo trae).
--   docker compose exec -T db psql -U mooping -d mooping < db/upgrade-roles.sql
-- =====================================================================

BEGIN;

ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_role_check;

UPDATE memberships
   SET role = CASE WHEN role IN ('owner', 'admin') THEN 'owner' ELSE 'user' END;

ALTER TABLE memberships ALTER COLUMN role SET DEFAULT 'user';
ALTER TABLE memberships ADD CONSTRAINT memberships_role_check CHECK (role IN ('owner', 'user'));

COMMIT;
