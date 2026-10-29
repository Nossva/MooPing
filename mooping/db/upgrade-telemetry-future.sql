-- =====================================================================
-- Lecturas con fecha en el futuro (reloj de la Pi adelantado).
-- devices.last_seen_at y animal_last_position se quedan con la lectura más
-- nueva, así que una fecha futura los dejaba congelados: el collar nunca daba
-- "sin señal" y el mapa no se movía. El backend ya no acepta fechas futuras;
-- esto recalcula los que hayan quedado así con la última lectura válida.
-- Las lecturas en sí no se tocan. Idempotente.
--   docker compose exec -T db psql -U mooping -d mooping < db/upgrade-telemetry-future.sql
-- =====================================================================

UPDATE devices d
   SET last_seen_at = (SELECT max(r.recorded_at) FROM telemetry_readings r
                        WHERE r.device_id = d.id AND r.recorded_at <= now())
 WHERE d.last_seen_at > now() + interval '5 minutes';

UPDATE animal_last_position alp
   SET device_id   = r.device_id,
       recorded_at = r.recorded_at,
       location    = r.location,
       speed_mps   = r.speed_mps,
       heading_deg = r.heading_deg,
       temp_body_c = r.temp_body_c,
       activity    = r.activity
  FROM (SELECT DISTINCT ON (t.animal_id) t.*
          FROM telemetry_readings t
         WHERE t.location IS NOT NULL AND t.recorded_at <= now()
           AND t.animal_id IN (SELECT animal_id FROM animal_last_position
                                WHERE recorded_at > now() + interval '5 minutes')
         ORDER BY t.animal_id, t.recorded_at DESC) r
 WHERE r.animal_id = alp.animal_id
   AND alp.recorded_at > now() + interval '5 minutes';

-- Sin ninguna lectura válida: se borra y la próxima lectura la vuelve a crear.
DELETE FROM animal_last_position WHERE recorded_at > now() + interval '5 minutes';
