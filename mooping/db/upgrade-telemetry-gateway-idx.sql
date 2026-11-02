-- =====================================================================
-- telemetry_gateway_time_idx: "Collares escuchados" de cada estación en Equipos.
-- Solo para bases creadas antes del cambio (schema.sql ya lo trae).
--   docker compose exec -T db psql -U mooping -d mooping < db/upgrade-telemetry-gateway-idx.sql
-- =====================================================================

CREATE INDEX IF NOT EXISTS telemetry_gateway_time_idx ON telemetry_readings (gateway_id, recorded_at DESC);
