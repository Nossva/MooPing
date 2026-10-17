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
--   * Units in column names: _m, _c, _v, _dbm, _db, _mps.
--   * Every business row belongs to an organization (establecimiento);
--     queries from the web always filter by organization_id.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- =====================================================================
-- ORGANIZATIONS & USERS
-- =====================================================================

CREATE TABLE organizations (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL,
  phone          TEXT,
  password_hash  TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_key ON users (lower(email));

CREATE TABLE memberships (
  organization_id  BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role             TEXT NOT NULL DEFAULT 'viewer'
                   CHECK (role IN ('owner', 'admin', 'operator', 'viewer')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE INDEX memberships_user_idx ON memberships (user_id);

-- =====================================================================
-- FIELD INFRASTRUCTURE
-- =====================================================================

-- Each Raspberry Pi receiving station. api_key_hash is only needed when the
-- Pi talks to the server over the internet.
CREATE TABLE gateways (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id  BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  gateway_uid      TEXT NOT NULL UNIQUE,
  name             TEXT,
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
-- organization_id is NULL while the collar is in stock.
CREATE TABLE devices (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id  BIGINT REFERENCES organizations(id) ON DELETE SET NULL,
  device_uid       TEXT NOT NULL UNIQUE,
  hardware_version TEXT,
  firmware_version TEXT,
  battery_v        REAL,
  last_seen_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX devices_org_idx ON devices (organization_id);

-- =====================================================================
-- ANIMALS
-- =====================================================================

CREATE TABLE animals (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id  BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  yard_id          BIGINT REFERENCES yards(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  tag_number       TEXT,                 -- caravana / RFID
  species          TEXT NOT NULL DEFAULT 'cattle',
  sex              TEXT CHECK (sex IN ('female', 'male')),
  breed            TEXT,
  birth_date       DATE,
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
  speed_mps        REAL,
  hdop             REAL,
  satellites       SMALLINT,

  temp_body_c      REAL,                   -- "TEMP" in today's payload
  temp_ambient_c   REAL,
  activity         REAL,                   -- MPU6050 derived index, 0..1
  battery_v        REAL,

  rssi_dbm         SMALLINT,               -- LoRa link quality at the Pi
  snr_db           REAL
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
  temp_body_c  REAL,
  activity     REAL,
  battery_v    REAL
);

CREATE INDEX animal_last_position_gix ON animal_last_position USING GIST (location);

-- Keeps devices.last_seen_at and animal_last_position current on every insert.
CREATE OR REPLACE FUNCTION telemetry_after_insert() RETURNS trigger AS $$
BEGIN
  UPDATE devices
     SET last_seen_at = GREATEST(COALESCE(last_seen_at, NEW.recorded_at), NEW.recorded_at),
         battery_v    = COALESCE(NEW.battery_v, battery_v)
   WHERE id = NEW.device_id;

  IF NEW.animal_id IS NOT NULL AND NEW.location IS NOT NULL THEN
    INSERT INTO animal_last_position AS alp
      (animal_id, device_id, recorded_at, location, temp_body_c, activity, battery_v)
    VALUES
      (NEW.animal_id, NEW.device_id, NEW.recorded_at, NEW.location,
       NEW.temp_body_c, NEW.activity, NEW.battery_v)
    ON CONFLICT (animal_id) DO UPDATE
      SET device_id   = EXCLUDED.device_id,
          recorded_at = EXCLUDED.recorded_at,
          location    = EXCLUDED.location,
          temp_body_c = EXCLUDED.temp_body_c,
          activity    = EXCLUDED.activity,
          battery_v   = EXCLUDED.battery_v
      WHERE alp.recorded_at <= EXCLUDED.recorded_at;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telemetry_after_insert_trg
  AFTER INSERT ON telemetry_readings
  FOR EACH ROW EXECUTE FUNCTION telemetry_after_insert();

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

CREATE TABLE alerts (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id  BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  animal_id        BIGINT REFERENCES animals(id) ON DELETE CASCADE,
  device_id        BIGINT REFERENCES devices(id) ON DELETE SET NULL,
  yard_id          BIGINT REFERENCES yards(id) ON DELETE SET NULL,
  type             TEXT NOT NULL
                   CHECK (type IN ('geofence_exit', 'fever', 'no_signal',
                                   'low_battery', 'low_activity')),
  severity         TEXT NOT NULL DEFAULT 'warning'
                   CHECK (severity IN ('info', 'warning', 'critical')),
  message          TEXT,
  metadata         JSONB NOT NULL DEFAULT '{}',
  triggered_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at  TIMESTAMPTZ,
  resolved_at      TIMESTAMPTZ
);

CREATE INDEX alerts_org_open_idx ON alerts (organization_id, triggered_at DESC)
  WHERE resolved_at IS NULL;
CREATE INDEX alerts_animal_idx ON alerts (animal_id, triggered_at DESC);
