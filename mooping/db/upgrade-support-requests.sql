-- =====================================================================
-- support_requests: reclamos enviados desde la pestaña Soporte.
-- Solo para bases creadas antes del cambio (schema.sql ya lo trae).
--   docker compose exec -T db psql -U mooping -d mooping < db/upgrade-support-requests.sql
-- =====================================================================

-- "Soporte técnico": what a member sends from the Soporte screen. The backend
-- also emails it to SUPPORT_EMAIL; email_sent_at stays NULL if that failed or
-- wasn't configured (email_error says why).
CREATE TABLE IF NOT EXISTS support_requests (
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

-- Bases donde la tabla se creó antes de agregar la categoría.
ALTER TABLE support_requests ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other'
  CHECK (category IN ('collar', 'gateway', 'app', 'other'));

CREATE INDEX IF NOT EXISTS support_requests_user_idx ON support_requests (organization_id, user_id, created_at DESC);
