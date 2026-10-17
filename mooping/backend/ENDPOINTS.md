# MooPing API

Base: `http://localhost:8000/api/`. Todo es JSON. Fechas en ISO 8601 (UTC); el
frontend calcula "hace 8 min".

## Autenticación

1. `POST /api/auth/login/` con `{"email", "password"}` → devuelve `token`.
2. En cada request: `Authorization: Bearer <token>`.
3. Opcional: `X-Organization-Id: <id>` para elegir establecimiento (por defecto, el primero del usuario).

Demo (`python manage.py seed_demo`): `demo@mooping.app` / `mooping123`.

Errores: `{"detail": "mensaje"}` con 400, 401, 403, 404 o 409. Los errores de
validación de campos vienen como `{"campo": ["mensaje"]}`.

## Endpoints por pantalla

### Comunes (header, campana, barra verde)

| Método | Ruta | Devuelve |
|---|---|---|
| GET | `health/` | `{status, database}` (sin login) |
| POST | `auth/login/` | `{token, user, organizations}` (sin login) |
| POST | `auth/logout/` | 204 |
| GET | `me/` | `{user: {id, name, email, phone, initials}, organizations: [{id, name, role}]}` |
| GET | `status/` | `{online, last_packet_at, radio, gateways_online, gateways_total, open_alerts, server_time}` |

### Inicio

| Método | Ruta | Devuelve |
|---|---|---|
| GET | `dashboard/summary/` | `{organization, pending_total, pending_by_category: {urgent, sanitary, equipment}, top_alert, herd_health: {animals_total, animals_reporting, pct, series: [{date, pct}]}}` |
| GET | `alerts/?status=open&sort=urgency` | "Para atender" (lista de alertas, ver formato abajo) |
| GET | `alerts/?status=resolved&since=today&sort=recent` | "Resuelto hoy" |
| GET | `devices/?filter=needs_attention` | "Equipos: N para revisar" |
| PATCH | `alerts/{id}/` | Botón "Asignar" / cambiar estado |
| POST | `alerts/{id}/notes/` | Botón "Anotar" |
| POST | `devices/{id}/maintenance/` | "Agendar cambio de pila" |
| POST | `devices/{id}/ping/` | "Enviar ping forzado" |
| GET | `products/` | "Comprar equipamiento" (sin login) |

### Monitoreo

| Método | Ruta | Devuelve |
|---|---|---|
| GET | `yards/` | Potreros: `[{id, name, area_ha, boundary (GeoJSON), animal_count}]` |
| GET | `monitoring/summary/?yard_id=` | `{yard, herd: {total, with_position, inside_geofence, outside_geofence, safe_pct}, alerts: {active, geofence, health}, gateway: {name, battery_pct, power_source, radio, online}}` |
| GET | `animals/positions/?yard_id=&geofence=inside\|outside` | Marcadores del mapa: `[{id, name, lat, lng, recorded_at, geofence_status, has_alert}]` |
| GET | `animals/?search=&yard_id=&geofence=` | Buscador "caravana, collar #C o lote" (formato animal) |
| GET | `animals/{id}/` | Ficha (formato animal + `temp_range_c`, `temp_in_range`, `activity_today_km`, `rumination_4h_min`, `notes`, `open_alerts`) |
| GET | `animals/{id}/track/?hours=24` | "Ver historial de recorrido": `{points: [{recorded_at, lat, lng, speed_kmh, heading_deg, temp_body_c}]}` |
| POST | `animals/{id}/alarm/` | "Alarma sonora" → 202 `{command_id, device_id, status: "queued"}` |
| PATCH | `animals/{id}/` | "Editar ficha" / "Ficha sanitaria" |
| POST | `animals/` | Alta de animal |
| POST · PATCH · DELETE | `yards/`, `yards/{id}/` | Crear / editar / borrar potrero (`boundary` = GeoJSON Polygon) |

### Alertas

| Método | Ruta | Devuelve |
|---|---|---|
| GET | `alerts/summary/` | `{open_total, by_category: {critical, sanitary, equipment}, by_type, critical_unattended, last_packet_at}` |
| GET | `alerts/?category=critical\|sanitary\|equipment` | Chips Todas / Críticas / Sanitarias / Equipos |
| GET | `alerts/{id}/` | Alerta + `notes` |
| GET · POST | `alerts/{id}/notes/` | Notas `{id, body, created_at, user}` |
| GET · PUT | `notification-settings/` | `{alarm_sound, notify_geofence, notify_health, notify_equipment, channel_push, channel_email, channel_sms}` |

### Equipos

| Método | Ruta | Devuelve |
|---|---|---|
| GET | `infrastructure/summary/` | `{collars: {total, active, assigned, no_signal, in_stock, operative_pct}, gateways: {total, online, coverage_ha}, repeaters: {total, online, names}, batteries: {average_pct, low_count}, server: {name, status}, last_sync_at}` |
| GET | `devices/?search=&filter=low_battery\|alert\|stock\|no_signal\|needs_attention` | `{counts: {all, low_battery, alert, stock, no_signal, needs_attention}, items: [collar]}` |
| GET | `devices/{id}/` | Collar + `maintenance` + `pending_commands` |
| POST | `devices/` | "Emparejar nuevo collar (NFC/QR)": `{device_uid, label?, ...}` |
| PATCH | `devices/{id}/` | "Configurar": `label`, `tx_interval_s` (10–3600), `battery_model`, `storage_location`, ... |
| POST | `devices/{id}/assign/` | "Vincular a un animal": `{animal_id}` |
| POST | `devices/{id}/unassign/` | Desvincular: `{storage_location?}` |
| GET | `gateways/` | `[{id, gateway_uid, name, kind: gateway\|repeater, power_source, battery_pct, radio, coverage_ha, last_seen_at, lat, lng, online}]` |

### Raspberry Pi

| Método | Ruta | Para qué |
|---|---|---|
| POST | `telemetry/` | Una lectura o una lista. Sin login; si `TELEMETRY_API_KEY` está configurada, header `X-Api-Key`. |
| TCP | puerto `4001` | Lo mismo por TCP (servicio `telemetry`), para `lora_receiver.c` sin cambios: solo apuntar `BACKEND_IP` a esta PC. |

Payload que manda la Pi hoy: `{"ID":"COLLAR-3","LAT":-34.70,"LONG":-58.24,"TEMP":"38.40"}`.
Campos opcionales que ya se aceptan: `BAT` (%), `RSSI`, `SNR`, `ACT`, `RUM`
(minutos de rumia desde la lectura anterior), `SPEED` (m/s), `HEADING`, `TS`
(hora de la medición), `GW` (id del gateway). Si no vienen velocidad y rumbo, se
calculan con la lectura anterior. `LAT`/`LONG` en 0 (GPS sin fix) se guarda sin posición.

## Formatos

### Alerta

```json
{
  "id": 12, "type": "geofence_exit", "category": "critical", "severity": "critical",
  "status": "pending", "message": "Vaca #084 fuera del perímetro, a 297 m del límite.",
  "metadata": {"distance_m": 297, "lat": -34.25, "lng": -59.43},
  "triggered_at": "...", "resolved_at": null,
  "animal": {"id": 1, "name": "Vaca #084", "tag_number": "AR-039-994", "breed": "...", "lot": "...", "age_months": 40},
  "device": {"id": 1, "label": "C-084", "device_uid": "COLLAR-84", "battery_pct": 74, "battery_days_left": 24, "rssi_dbm": -98, "last_seen_at": "..."},
  "yard": {"id": 1, "name": "Potrero 4 (Sur)"},
  "assigned_to": null, "resolved_by": null,
  "position": {"lat": -34.25, "lng": -59.43}, "speed_kmh": 1.0, "heading_label": "Este 90°"
}
```

- `type`: `geofence_exit`, `fever`, `low_activity`, `low_battery`, `no_signal`
- `category`: `critical`, `sanitary`, `equipment`
- `status`: `pending` → `assigned` → `in_progress` → `resolved`

`PATCH alerts/{id}/` acepta `{"status": "...", "assigned_to": user_id}`. Si
asignás una alerta pendiente sin mandar `status`, pasa sola a `assigned`.

Reglas automáticas al llegar una lectura:
- Fuera del potrero → `geofence_exit`. Se resuelve sola cuando vuelve.
- Temperatura ≥ `fever_threshold_c` (39.2) → `fever`.
- Batería < 20 % → `low_battery`.
- Sin datos por más de 30 min → `no_signal`, que revisa el servicio `telemetry` cada minuto. Se resuelve sola al volver la señal.

### Animal

`{id, name, tag_number, lot, species, sex, breed, birth_date, age_months, photo_url, status, yard, geofence_status: inside|outside|unknown, distance_outside_m, health_status: optimal|alert, open_alerts, position: {lat, lng, recorded_at}, speed_kmh, heading_deg, heading_label, temp_body_c, device: {id, label, device_uid, battery_pct, rssi_dbm, last_seen_at, tx_interval_s, firmware_version}}`

### Collar

`{id, device_uid, label, state: optimal|low_battery|alert|no_signal|stock, hardware_version, firmware_version, battery_pct, battery_days_left, battery_model, rssi_dbm, tx_interval_s, last_seen_at, storage_location, geofence_alert_since, animal: {id, name, breed, lot, yard_name, geofence_status}}`

## Limitaciones actuales

- **Batería, rumia, actividad y señal:** el collar hoy no las manda. Los campos quedan en `null` hasta que el firmware las envíe (`BAT`, `RUM`, `ACT`). La señal (`RSSI`) la puede agregar la Pi.
- **Ping forzado, alarma sonora y cambio de intervalo:** se guardan en `device_commands` con estado `queued`. Falta que la Pi pueda enviar mensajes al collar.
