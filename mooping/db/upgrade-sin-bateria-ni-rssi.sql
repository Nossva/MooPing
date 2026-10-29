-- =====================================================================
-- Sin batería del collar ni señal LoRa (RSSI/SNR).
-- La Pi no manda la batería del collar, y RSSI/SNR no se usan: se sacan las
-- columnas, la alerta "batería baja" y el umbral low_battery_pct.
-- La batería de los gateways (gateways.battery_pct) y devices.battery_model
-- se quedan. Borra las alertas de batería baja que hubiera. Idempotente.
--   docker compose exec -T db psql -U mooping -d mooping < db/upgrade-sin-bateria-ni-rssi.sql
-- =====================================================================

BEGIN;

-- 1. Trigger sin las columnas que se borran (antes de borrarlas).
CREATE OR REPLACE FUNCTION telemetry_after_insert() RETURNS trigger AS $$
BEGIN
  UPDATE devices
     SET last_seen_at = GREATEST(COALESCE(last_seen_at, NEW.recorded_at), NEW.recorded_at)
   WHERE id = NEW.device_id;

  IF NEW.gateway_id IS NOT NULL THEN
    UPDATE gateways SET last_seen_at = now() WHERE id = NEW.gateway_id;
  END IF;

  IF NEW.animal_id IS NOT NULL AND NEW.location IS NOT NULL THEN
    INSERT INTO animal_last_position AS alp
      (animal_id, device_id, recorded_at, location, speed_mps, heading_deg,
       temp_body_c, activity)
    VALUES
      (NEW.animal_id, NEW.device_id, NEW.recorded_at, NEW.location, NEW.speed_mps,
       NEW.heading_deg, NEW.temp_body_c, NEW.activity)
    ON CONFLICT (animal_id) DO UPDATE
      SET device_id   = EXCLUDED.device_id,
          recorded_at = EXCLUDED.recorded_at,
          location    = EXCLUDED.location,
          speed_mps   = EXCLUDED.speed_mps,
          heading_deg = EXCLUDED.heading_deg,
          temp_body_c = EXCLUDED.temp_body_c,
          activity    = EXCLUDED.activity
      WHERE alp.recorded_at <= EXCLUDED.recorded_at;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 2. Alerta "batería baja": fuera (con sus notas, ON DELETE CASCADE).
DELETE FROM alerts WHERE type = 'low_battery';
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_type_check;
ALTER TABLE alerts ADD CONSTRAINT alerts_type_check
  CHECK (type IN ('geofence_exit', 'fever', 'no_signal', 'low_activity'));

-- 3. Columnas.
ALTER TABLE organizations        DROP COLUMN IF EXISTS low_battery_pct;
ALTER TABLE devices              DROP COLUMN IF EXISTS battery_pct,
                                 DROP COLUMN IF EXISTS last_rssi_dbm;
ALTER TABLE telemetry_readings   DROP COLUMN IF EXISTS battery_pct,
                                 DROP COLUMN IF EXISTS rssi_dbm,
                                 DROP COLUMN IF EXISTS snr_db;
ALTER TABLE animal_last_position DROP COLUMN IF EXISTS battery_pct,
                                 DROP COLUMN IF EXISTS rssi_dbm;

COMMIT;
