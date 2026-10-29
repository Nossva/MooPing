-- =====================================================================
-- Telemetría con NaN / Infinity: los pasa a NULL.
-- Un sensor que falla puede mandar "nan"; guardado así rompe las pantallas
-- que lo muestran (Monitoreo, Equipos...). El backend ya no los acepta; esto
-- limpia los que hayan entrado antes. Idempotente.
--   docker compose exec -T db psql -U mooping -d mooping < db/upgrade-telemetry-nan.sql
-- =====================================================================

UPDATE telemetry_readings SET speed_mps = NULL      WHERE speed_mps      IN ('NaN', 'Infinity', '-Infinity');
UPDATE telemetry_readings SET heading_deg = NULL    WHERE heading_deg    IN ('NaN', 'Infinity', '-Infinity');
UPDATE telemetry_readings SET temp_body_c = NULL    WHERE temp_body_c    IN ('NaN', 'Infinity', '-Infinity');
UPDATE telemetry_readings SET activity = NULL       WHERE activity       IN ('NaN', 'Infinity', '-Infinity');
UPDATE telemetry_readings SET rumination_min = NULL WHERE rumination_min IN ('NaN', 'Infinity', '-Infinity');
UPDATE telemetry_readings SET battery_pct = NULL    WHERE battery_pct    IN ('NaN', 'Infinity', '-Infinity');
UPDATE telemetry_readings SET snr_db = NULL         WHERE snr_db         IN ('NaN', 'Infinity', '-Infinity');

UPDATE animal_last_position SET speed_mps = NULL   WHERE speed_mps   IN ('NaN', 'Infinity', '-Infinity');
UPDATE animal_last_position SET heading_deg = NULL WHERE heading_deg IN ('NaN', 'Infinity', '-Infinity');
UPDATE animal_last_position SET temp_body_c = NULL WHERE temp_body_c IN ('NaN', 'Infinity', '-Infinity');
UPDATE animal_last_position SET activity = NULL    WHERE activity    IN ('NaN', 'Infinity', '-Infinity');
UPDATE animal_last_position SET battery_pct = NULL WHERE battery_pct IN ('NaN', 'Infinity', '-Infinity');

UPDATE devices SET battery_pct = NULL WHERE battery_pct IN ('NaN', 'Infinity', '-Infinity');
