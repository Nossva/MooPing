-- =====================================================================
-- MooPing - Database schema
-- PostgreSQL 15+ with PostGIS
-- =====================================================================
--
-- DATA FLOW
--   AgroNeck (collar) --LoRa--> Raspberry Pi (lora_receiver.c, stores nothing)
--   --JSON--> MooPing server --> THIS DATABASE --> web
--
--   Payload the Pi sends today, one per LoRa packet:
--     {"ID":"COLLAR-3","LAT":-34.707652,"LONG":-58.242300,"TEMP":"38.40"}
--   The server resolves ID -> devices.device_uid, finds the animal with the
--   active collar assignment and inserts one row in telemetry_readings.
--   recorded_at defaults to the moment the server receives the reading.
--
-- CONVENTIONS
--   * BIGINT identity keys, TIMESTAMPTZ everywhere (stored in UTC).
--   * Geography in SRID 4326 (ST_MakePoint(lng, lat)).
--   * Units in column names: _m, _c, _pct, _dbm, _db, _mps, _deg, _min, _s, _ha.
--   * Every business row belongs to an organization (establecimiento);
--     queries from the web always filter by organization_id.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- =====================================================================
-- ORGANIZATIONS & USERS
-- =====================================================================

-- Alert thresholds live per establecimiento.
CREATE TABLE organizations (
  id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name                 TEXT NOT NULL,
  vet_phone            TEXT,                      -- "Llamar Veterinario"
  fever_threshold_c    REAL NOT NULL DEFAULT 39.2,
  no_signal_minutes    INTEGER NOT NULL DEFAULT 30,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL,
  phone          TEXT,
  password_hash  TEXT NOT NULL,               -- Django password hasher format
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_key ON users (lower(email));

CREATE TABLE memberships (
  organization_id  BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- owner = "Dueño" (CRUD + Administración); user = "Usuario" (ve todo,
  -- atiende alertas y edita sus notificaciones).
  role             TEXT NOT NULL DEFAULT 'user'
                   CHECK (role IN ('owner', 'user')),
  -- false = acceso suspendido por el dueño (sigue en la lista, no puede entrar)
  active           BOOLEAN NOT NULL DEFAULT true,
  -- Permisos de un "user" (el dueño siempre ve todo):
  -- sections: secciones que ve (["inicio","monitoreo","alertas","equipos"]); NULL = todas,
  --   incluidas las que se agreguen después.
  -- all_yards: true = todos los potreros; false = solo member_yards + member_animals.
  sections         JSONB,
  all_yards        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE INDEX memberships_user_idx ON memberships (user_id);

-- Bearer tokens for the API. Only the SHA-256 of the token is stored.
CREATE TABLE api_tokens (
  token_hash    TEXT PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMPTZ
);

CREATE INDEX api_tokens_user_idx ON api_tokens (user_id);

CREATE TABLE notification_settings (
  organization_id     BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alarm_sound         BOOLEAN NOT NULL DEFAULT true,   -- "Alarma Activa"
  notify_geofence     BOOLEAN NOT NULL DEFAULT true,
  notify_health       BOOLEAN NOT NULL DEFAULT true,
  notify_equipment    BOOLEAN NOT NULL DEFAULT true,
  channel_push        BOOLEAN NOT NULL DEFAULT true,
  channel_email       BOOLEAN NOT NULL DEFAULT false,
  channel_sms         BOOLEAN NOT NULL DEFAULT false,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

-- =====================================================================
-- FIELD INFRASTRUCTURE
-- =====================================================================

-- Receiving stations (Raspberry Pi gateways) and LoRa repeaters.
-- api_key_hash is only needed when the Pi talks to the server over the internet.
CREATE TABLE gateways (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id  BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  gateway_uid      TEXT NOT NULL UNIQUE,
  name             TEXT,
  kind             TEXT NOT NULL DEFAULT 'gateway' CHECK (kind IN ('gateway', 'repeater')),
  power_source     TEXT CHECK (power_source IN ('solar', 'grid', 'battery')),
  battery_pct      REAL,
  radio            TEXT,                      -- e.g. 'LoRa 433 MHz'
  coverage_ha      REAL,
  api_key_hash     TEXT,
  location         GEOGRAPHY(POINT, 4326),
  last_seen_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX gateways_org_idx ON gateways (organization_id);

-- Paddocks / potreros.
CREATE TABLE yards (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id  BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  boundary         GEOGRAPHY(POLYGON, 4326) NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE INDEX yards_boundary_gix ON yards USING GIST (boundary);

-- Collars (AgroNeck). device_uid matches the "ID" the Pi sends (e.g. COLLAR-3).
-- organization_id is NULL while the collar is in the factory stock.
CREATE TABLE devices (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id   BIGINT REFERENCES organizations(id) ON DELETE SET NULL,
  device_uid        TEXT NOT NULL UNIQUE,
  label             TEXT,                     -- name shown in the app, e.g. 'C-084'
  hardware_version  TEXT,
  firmware_version  TEXT,
  battery_model     TEXT,                     -- e.g. 'ER34615 (3.6V D)'
  tx_interval_s     INTEGER NOT NULL DEFAULT 60,
  storage_location  TEXT,                     -- where an unassigned collar is kept
  last_seen_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX devices_org_idx ON devices (organization_id);

-- =====================================================================
-- ANIMALS
-- =====================================================================

CREATE TABLE animals (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id  BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  yard_id          BIGINT REFERENCES yards(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,             -- e.g. 'Vaca #084'
  tag_number       TEXT,                      -- caravana oficial, e.g. 'AR-039-994'
  lot              TEXT,                      -- lote / rodeo
  species          TEXT NOT NULL DEFAULT 'cattle',
  sex              TEXT CHECK (sex IN ('female', 'male')),
  breed            TEXT,
  birth_date       DATE,
  photo_url        TEXT,
  notes            TEXT,
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'inactive', 'sold', 'dead')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, tag_number)
);

CREATE INDEX animals_org_idx  ON animals (organization_id);
CREATE INDEX animals_yard_idx ON animals (yard_id);

-- Collar assignment history. At most one active collar per animal and one
-- active animal per collar; the same pair can be assigned again later.
CREATE TABLE animal_devices (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  animal_id      BIGINT NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  device_id      BIGINT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  assigned_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  unassigned_at  TIMESTAMPTZ,
  CHECK (unassigned_at IS NULL OR unassigned_at > assigned_at)
);

CREATE UNIQUE INDEX animal_devices_active_animal_key
  ON animal_devices (animal_id) WHERE unassigned_at IS NULL;
CREATE UNIQUE INDEX animal_devices_active_device_key
  ON animal_devices (device_id) WHERE unassigned_at IS NULL;

-- Alcance de un usuario con memberships.all_yards = false: ve los animales de
-- estos potreros más estos animales sueltos (y sus alertas y collares).
CREATE TABLE member_yards (
  organization_id  BIGINT NOT NULL,
  user_id          BIGINT NOT NULL,
  yard_id          BIGINT NOT NULL REFERENCES yards(id) ON DELETE CASCADE,
  PRIMARY KEY (organization_id, user_id, yard_id),
  FOREIGN KEY (organization_id, user_id) REFERENCES memberships ON DELETE CASCADE
);

CREATE TABLE member_animals (
  organization_id  BIGINT NOT NULL,
  user_id          BIGINT NOT NULL,
  animal_id        BIGINT NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  PRIMARY KEY (organization_id, user_id, animal_id),
  FOREIGN KEY (organization_id, user_id) REFERENCES memberships ON DELETE CASCADE
);

-- =====================================================================
-- TELEMETRY
-- =====================================================================

CREATE TABLE telemetry_readings (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  device_id        BIGINT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  animal_id        BIGINT REFERENCES animals(id) ON DELETE SET NULL,
  gateway_id       BIGINT REFERENCES gateways(id) ON DELETE SET NULL,
  recorded_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  location         GEOGRAPHY(POINT, 4326),
  altitude_m       REAL,
  speed_mps        REAL,                    -- sent by the collar or derived on ingest
  heading_deg      REAL,                    -- 0 = North, 90 = East
  hdop             REAL,
  satellites       SMALLINT,

  temp_body_c      REAL,                    -- "TEMP" in today's payload
  temp_ambient_c   REAL,
  activity         REAL,                    -- MPU6050 derived index, 0..1
  rumination_min   REAL                     -- rumination minutes since the previous reading
);

CREATE INDEX telemetry_animal_time_idx ON telemetry_readings (animal_id, recorded_at DESC);
CREATE INDEX telemetry_device_time_idx ON telemetry_readings (device_id, recorded_at DESC);
CREATE INDEX telemetry_time_brin       ON telemetry_readings USING BRIN (recorded_at);
CREATE INDEX telemetry_location_gix    ON telemetry_readings USING GIST (location);

-- Latest known state per animal, so the map does not scan telemetry.
CREATE TABLE animal_last_position (
  animal_id    BIGINT PRIMARY KEY REFERENCES animals(id) ON DELETE CASCADE,
  device_id    BIGINT REFERENCES devices(id) ON DELETE SET NULL,
  recorded_at  TIMESTAMPTZ NOT NULL,
  location     GEOGRAPHY(POINT, 4326) NOT NULL,
  speed_mps    REAL,
  heading_deg  REAL,
  temp_body_c  REAL,
  activity     REAL
);

CREATE INDEX animal_last_position_gix ON animal_last_position USING GIST (location);

-- Keeps devices and animal_last_position current on every insert.
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

CREATE TRIGGER telemetry_after_insert_trg
  AFTER INSERT ON telemetry_readings
  FOR EACH ROW EXECUTE FUNCTION telemetry_after_insert();

-- =====================================================================
-- ALERTS
-- =====================================================================

-- category is derived from type in the backend:
--   geofence_exit -> critical | fever, low_activity -> sanitary
--   no_signal -> equipment
CREATE TABLE alerts (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id  BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  animal_id        BIGINT REFERENCES animals(id) ON DELETE CASCADE,
  device_id        BIGINT REFERENCES devices(id) ON DELETE SET NULL,
  yard_id          BIGINT REFERENCES yards(id) ON DELETE SET NULL,
  type             TEXT NOT NULL
                   CHECK (type IN ('geofence_exit', 'fever', 'no_signal', 'low_activity')),
  severity         TEXT NOT NULL DEFAULT 'warning'
                   CHECK (severity IN ('info', 'warning', 'critical')),
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'assigned', 'in_progress', 'resolved')),
  message          TEXT,
  metadata         JSONB NOT NULL DEFAULT '{}',   -- values shown in the card (temp, distance...)
  triggered_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_to      BIGINT REFERENCES users(id) ON DELETE SET NULL,
  resolved_by      BIGINT REFERENCES users(id) ON DELETE SET NULL,
  resolved_at      TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX alerts_org_open_idx ON alerts (organization_id, triggered_at DESC)
  WHERE status <> 'resolved';
CREATE INDEX alerts_animal_idx ON alerts (animal_id, triggered_at DESC);
CREATE INDEX alerts_device_idx ON alerts (device_id, triggered_at DESC);

CREATE TABLE alert_notes (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alert_id    BIGINT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX alert_notes_alert_idx ON alert_notes (alert_id, created_at);

-- =====================================================================
-- OPERATIONS
-- =====================================================================

-- "Agendar cambio de pila" and other field work on a collar or gateway.
CREATE TABLE maintenance_tasks (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id  BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  device_id        BIGINT REFERENCES devices(id) ON DELETE CASCADE,
  gateway_id       BIGINT REFERENCES gateways(id) ON DELETE CASCADE,
  kind             TEXT NOT NULL DEFAULT 'battery_replacement'
                   CHECK (kind IN ('battery_replacement', 'repair', 'inspection')),
  scheduled_for    DATE NOT NULL,
  notes            TEXT,
  status           TEXT NOT NULL DEFAULT 'scheduled'
                   CHECK (status IN ('scheduled', 'done', 'cancelled')),
  created_by       BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (device_id IS NOT NULL OR gateway_id IS NOT NULL)
);

CREATE INDEX maintenance_tasks_org_idx ON maintenance_tasks (organization_id, scheduled_for);

-- "Soporte técnico": what a member sends from the Soporte screen. The backend
-- also emails it to SUPPORT_EMAIL; email_sent_at stays NULL if that failed or
-- wasn't configured (email_error says why).
CREATE TABLE support_requests (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id  BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          BIGINT REFERENCES users(id) ON DELETE SET NULL,
  category         TEXT NOT NULL DEFAULT 'other'
                   CHECK (category IN ('collar', 'gateway', 'app', 'other')),
  message          TEXT NOT NULL,
  diagnostic       JSONB NOT NULL,          -- GET /api/support/ diagnostic at send time
  user_agent       TEXT,
  email_sent_at    TIMESTAMPTZ,
  email_error      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX support_requests_user_idx ON support_requests (organization_id, user_id, created_at DESC);

-- Downlink commands for a collar ("Enviar ping forzado", "Alarma sonora").
-- The Pi will fetch queued commands once it supports sending to collars.
CREATE TABLE device_commands (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  device_id    BIGINT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  command      TEXT NOT NULL CHECK (command IN ('ping', 'alarm_on', 'alarm_off', 'set_interval')),
  payload      JSONB NOT NULL DEFAULT '{}',
  status       TEXT NOT NULL DEFAULT 'queued'
               CHECK (status IN ('queued', 'sent', 'acked', 'failed')),
  created_by   BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at      TIMESTAMPTZ
);

CREATE INDEX device_commands_queue_idx ON device_commands (device_id, created_at)
  WHERE status = 'queued';

-- =====================================================================
-- DERIVED DATA
-- =====================================================================

-- Filled by a scheduled job from telemetry_readings (recomputable).
CREATE TABLE animal_daily_statistics (
  animal_id         BIGINT NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  distance_m        DOUBLE PRECISION NOT NULL DEFAULT 0,
  movement_minutes  INTEGER NOT NULL DEFAULT 0,
  rest_minutes      INTEGER NOT NULL DEFAULT 0,
  temp_body_avg_c   REAL,
  temp_body_max_c   REAL,
  readings_count    INTEGER NOT NULL DEFAULT 0,
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (animal_id, date)
);
