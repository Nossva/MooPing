-- =====================================================================
-- Permisos por usuario: secciones que ve y potreros / animales a su alcance.
-- Solo para bases creadas antes del cambio (schema.sql ya lo trae).
-- Idempotente: start.py lo corre en cada arranque.
--   docker compose exec -T db psql -U mooping -d mooping < db/upgrade-member-permissions.sql
-- =====================================================================

ALTER TABLE memberships ADD COLUMN IF NOT EXISTS sections JSONB;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS all_yards BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS member_yards (
  organization_id  BIGINT NOT NULL,
  user_id          BIGINT NOT NULL,
  yard_id          BIGINT NOT NULL REFERENCES yards(id) ON DELETE CASCADE,
  PRIMARY KEY (organization_id, user_id, yard_id),
  FOREIGN KEY (organization_id, user_id) REFERENCES memberships ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS member_animals (
  organization_id  BIGINT NOT NULL,
  user_id          BIGINT NOT NULL,
  animal_id        BIGINT NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  PRIMARY KEY (organization_id, user_id, animal_id),
  FOREIGN KEY (organization_id, user_id) REFERENCES memberships ON DELETE CASCADE
);
