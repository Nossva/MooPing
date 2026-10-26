-- =====================================================================
-- memberships.active: el dueño puede suspender el acceso de un usuario
-- sin sacarlo del establecimiento.
-- Solo para bases creadas antes del cambio (schema.sql ya lo trae).
--   docker compose exec -T db psql -U mooping -d mooping < db/upgrade-member-access.sql
-- =====================================================================

ALTER TABLE memberships ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
