-- =====================================================================
-- Sin batería en ningún lado: se saca gateways.battery_pct, devices.battery_model,
-- la alimentación 'battery' de las estaciones y el mantenimiento 'battery_replacement'
-- (pasa a 'repair'). Solo para bases creadas antes del cambio (schema.sql ya viene así).
-- Idempotente.
--   docker compose exec -T db psql -U mooping -d mooping < db/upgrade-sin-bateria.sql
-- =====================================================================

BEGIN;

ALTER TABLE gateways DROP COLUMN IF EXISTS battery_pct;
ALTER TABLE devices  DROP COLUMN IF EXISTS battery_model;

-- Estaciones a batería: queda sin dato de alimentación.
ALTER TABLE gateways DROP CONSTRAINT IF EXISTS gateways_power_source_check;
UPDATE gateways SET power_source = NULL WHERE power_source = 'battery';
ALTER TABLE gateways ADD CONSTRAINT gateways_power_source_check
  CHECK (power_source IN ('solar', 'grid'));

-- "Cambio de pila" agendado: queda como reparación.
ALTER TABLE maintenance_tasks DROP CONSTRAINT IF EXISTS maintenance_tasks_kind_check;
UPDATE maintenance_tasks SET kind = 'repair' WHERE kind = 'battery_replacement';
ALTER TABLE maintenance_tasks ALTER COLUMN kind SET DEFAULT 'repair';
ALTER TABLE maintenance_tasks ADD CONSTRAINT maintenance_tasks_kind_check
  CHECK (kind IN ('repair', 'inspection'));

COMMIT;
