# MooPing - Base de datos

PostgreSQL 16 + PostGIS. El esquema está en [schema.sql](schema.sql).

## Levantar la base

Se levanta junto con el backend desde [mooping/docker-compose.yml](../docker-compose.yml)
(ver [../README.md](../README.md)). La primera vez, el contenedor ejecuta `schema.sql`
automáticamente.

Conexión:

```
postgres://mooping:mooping@localhost:5432/mooping
```

## Volver a crear la base desde cero

`schema.sql` solo se ejecuta cuando el volumen está vacío. Después de cambiar el esquema
(desde `mooping/`):

```bash
docker compose down -v   # borra todos los datos
docker compose up -d
```

Si no querés perder los datos, algunos cambios traen un script de actualización.
`python start.py` los aplica todos en cada arranque, así que tienen que ser
**idempotentes** (`IF NOT EXISTS`, `DROP ... IF EXISTS`, etc.): correrlos dos veces no
puede romper nada.

| Script | Qué cambia |
|---|---|
| [upgrade-roles.sql](upgrade-roles.sql) | Roles `owner`/`admin`/`operator`/`viewer` → `owner` (Dueño) / `user` (Usuario) |
| [upgrade-member-access.sql](upgrade-member-access.sql) | `memberships.active`: suspender el acceso de un usuario sin sacarlo |
| [upgrade-member-permissions.sql](upgrade-member-permissions.sql) | Permisos por usuario: `memberships.sections` / `all_yards`, `member_yards`, `member_animals` |
| [upgrade-support-requests.sql](upgrade-support-requests.sql) | `support_requests`: reclamos enviados desde la pestaña Soporte |

Si levantás con `docker compose up` directo, aplicalos a mano (desde `mooping/`):

```bash
docker compose exec -T db psql -U mooping -d mooping < db/upgrade-roles.sql
docker compose exec -T db psql -U mooping -d mooping < db/upgrade-member-access.sql
docker compose exec -T db psql -U mooping -d mooping < db/upgrade-member-permissions.sql
```

## Tablas

| Tabla | Para qué |
|---|---|
| `organizations`, `users`, `memberships` | Establecimientos, usuarios y su rol en cada uno |
| `gateways` | Cada Raspberry Pi receptora |
| `yards` | Potreros (polígonos) |
| `devices` | Collares; `device_uid` es el `ID` que manda la Pi (`COLLAR-3`) |
| `animals`, `animal_devices` | Animales e historial de qué collar tuvo cada uno |
| `telemetry_readings` | Cada lectura recibida (posición, temperatura, etc.) |
| `animal_last_position` | Última posición de cada animal; la actualiza un trigger |
| `animal_daily_statistics` | Resumen diario por animal (lo calcula un job) |
| `alerts` | Salida de potrero, fiebre, sin señal, batería baja |

## Insertar una lectura

Con el payload que manda la Pi hoy (`{"ID":"COLLAR-3","LAT":-34.70,"LONG":-58.24,"TEMP":"38.40"}`):

```sql
INSERT INTO telemetry_readings (device_id, animal_id, location, temp_body_c)
SELECT d.id, ad.animal_id, ST_MakePoint(-58.24, -34.70)::geography, 38.40
FROM devices d
LEFT JOIN animal_devices ad ON ad.device_id = d.id AND ad.unassigned_at IS NULL
WHERE d.device_uid = 'COLLAR-3';
```
