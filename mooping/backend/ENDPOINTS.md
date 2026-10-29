# MooPing API

Base: `http://localhost:8000/api/`. Todo es JSON. Fechas en ISO 8601 (UTC); el
frontend calcula "hace 8 min".

## Autenticación

1. `POST /api/auth/login/` con `{"email", "password"}` → setea la cookie `mooping_session`
   (`HttpOnly`, `SameSite=Lax`, `Path=/api/`, `Secure` fuera de DEBUG). El token no viaja en el
   JSON: JavaScript no puede leerlo, así que un XSS no puede robar la sesión.
2. Cada request la manda sola (misma origen). Con `curl`: `-c cookies.txt` al loguearse y
   `-b cookies.txt` después.
3. **Escrituras** (POST, PUT, PATCH, DELETE): header `X-Requested-With: MooPing` obligatorio,
   si no → 403. Otro sitio no puede agregar ese header sin pasar por CORS: es la protección CSRF.
4. Opcional: `X-Organization-Id: <id>` para elegir establecimiento (por defecto, el primero del
   usuario). Si no sos miembro de ese establecimiento → 403.
5. La sesión dura `TOKEN_TTL_DAYS` (30). `auth/logout/` la borra; cambiar la contraseña cierra
   las demás sesiones. En la base solo se guarda el SHA-256 del token.

Demo (`python manage.py seed_demo`): `demo@mooping.app` / `mooping123`.

Errores: `{"detail": "mensaje"}` con 400, 401, 403, 404, 409 o 429. Los errores de
validación de campos vienen como `{"campo": ["mensaje"]}`.

### Contraseñas

- Se guardan hasheadas con PBKDF2-SHA256 (el hasher de Django). Nunca en texto plano.
- Toda contraseña nueva (`organization/members/`, `me/password/`,
  `organization/members/{id}/password/`) pasa por los validadores de Django
  (`AUTH_PASSWORD_VALIDATORS`): mínimo 8 caracteres, no puede ser una contraseña común
  (`password1`), ni solo números, ni parecida al nombre o al email. Si no cumple → 400
  con el motivo en `detail`.
- Los espacios cuentan: no se recortan en ningún endpoint. Máximo 200 caracteres.
- `auth/login/`: máximo `LOGIN_RATE` intentos por IP (por defecto `10/min`) y
  `LOGIN_ACCOUNT_RATE` por email desde cualquier IP (`20/hour`). Pasado el límite → 429
  `{"detail": "Demasiados intentos. Probá de nuevo en N s."}` con el header `Retry-After`.
  Los contadores viven en un caché en archivos (`CACHE_DIR`, `/tmp/mooping-cache`) compartido
  por los procesos de gunicorn.

## Roles y permisos

Cada usuario tiene un rol por establecimiento (`organizations[].role` en `login` y `me/`):

| Rol | Puede |
|---|---|
| `owner` (Dueño) | Todo: alta, edición y baja de potreros, animales, collares y usuarios; configurar el establecimiento; alarma sonora, ping y mantenimiento. |
| `user` (Usuario) | Ver (cualquier `GET`) lo que le permitan sus permisos (abajo); atender alertas (`PATCH alerts/{id}/`, `POST alerts/{id}/notes/`); editar sus preferencias (`PUT notification-settings/`). |

### Permisos de un usuario

El dueño los define con `PUT organization/members/{id}/access/`. El dueño siempre ve todo.

- **Secciones** (`organizations[].sections` en `me/`): `inicio`, `monitoreo`, `alertas`, `equipos`.
  Sin la sección, sus endpoints responden 403 `{"detail": "No tenés acceso a esta sección."}`:
  `inicio` → `dashboard/summary/`; `monitoreo` → `monitoring/summary/`, `animals/…` (GET);
  `alertas` → `alerts/…`; `equipos` → `devices/…`, `gateways/`, `infrastructure/summary/`.
  `status/`, `yards/`, `me/`, `notification-settings/` y `support/` no dependen de secciones.
- **Alcance**: con `all_yards: false` ve solo los animales de `yard_ids` más los animales
  sueltos de `animal_ids`, y a través de ellos sus collares, alertas, recorridos y
  contadores (`status/`, resúmenes de Inicio/Monitoreo/Equipos). `yards/` lista solo
  `yard_ids`. Lo que queda afuera responde 404 como si no existiera. Los collares en
  stock y las alertas sin animal ni potrero visible no se ven.
- No se le puede asignar una alerta que no ve (400).

- Cualquier otra escritura (`POST`/`PUT`/`PATCH`/`DELETE`) de un usuario responde
  403 `{"detail": "Solo el dueño puede hacer esto."}`. Las escrituras son solo del
  dueño por defecto, así que los endpoints nuevos quedan protegidos sin hacer nada.
- Un usuario solo puede asignarse alertas a sí mismo (`assigned_to` = su id). Si no, 403.
- El establecimiento siempre necesita al menos un dueño: degradar o quitar al último responde 409.

Demo: `demo@mooping.app` es dueño y `maria@mooping.app` es usuario (los dos con `mooping123`).

## Endpoints por pantalla

### Comunes (header, campana, barra verde)

| Método | Ruta | Devuelve |
|---|---|---|
| GET | `health/` | `{status, database}` (sin login) |
| POST | `auth/login/` | `{user, organizations}` + cookie de sesión (sin login) |
| POST | `auth/logout/` | 204 |
| POST | `me/password/` | `{current_password, new_password (ver Contraseñas)}` → 204. Cualquier usuario cambia la suya; se cierran sus otras sesiones. |
| GET | `me/` | `{user: {id, name, email, phone, initials}, organizations: [{id, name, role, sections}]}` |
| GET | `status/` | `{online, last_packet_at, radio, gateways_online, gateways_total, open_alerts, server_time}` |
| GET | `support/` | Pantalla Soporte: `{contacts: {whatsapp, email, phone, hours}, diagnostic: {organization, server: {name, server_time}, link: {online, last_packet_at, radio}, gateways: [{name, gateway_uid, kind, online, last_seen_at}], collars: {total, assigned, no_signal}, problem_collars: [{label, device_uid, animal_name, state, last_seen_at}] (hasta 10), open_alerts: {critical, sanitary, equipment}}}`. Los contactos salen de `SUPPORT_*` en `backend/.env` (`null` si no están) |
| GET | `support/requests/` | Mis reclamos (los 10 últimos del usuario): `[{id, category, message, created_at, emailed}]` |
| POST | `support/requests/` | Enviar reclamo `{category: collar\|gateway\|app\|other, message}` (hasta 2000 caracteres) → 201 con el reclamo. Se guarda con el diagnóstico y se manda por email a `SUPPORT_EMAIL` (responder le escribe al usuario). Si el email no sale, queda guardado con `emailed: false`. Cualquier miembro; límite `SUPPORT_RATE` (5/hora) → 429 |

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
| PATCH | `animals/{id}/` | "Editar ficha" / "Ficha sanitaria" |
| POST | `animals/{id}/photo/` | Subir foto: multipart con el archivo en `photo` (JPG, PNG, WEBP o GIF, hasta 5 MB). Reemplaza la anterior → el animal |
| DELETE | `animals/{id}/photo/` | Quitar la foto → el animal |
| GET | `media/animals/{nombre}` | El archivo de la foto. Pide sesión (el `<img>` manda la cookie) y que la foto sea de un animal de tu establecimiento; si no → 404. Es la URL que queda en `photo_url` |
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
| GET | `infrastructure/summary/` | `{collars: {total, active, assigned, no_signal, in_stock, operative_pct}, gateways: {total, online, coverage_ha}, repeaters: {total, online, names}, server: {name, status}, last_sync_at}` |
| GET | `devices/?search=&filter=alert\|stock\|no_signal\|needs_attention` | `{counts: {all, alert, stock, no_signal, needs_attention}, items: [collar]}` |
| GET | `devices/{id}/` | Collar + `maintenance` + `pending_commands` |
| GET | `devices/detected/` | "Detectados sin vincular": collares sin establecimiento cuya última lectura entró por un gateway propio (campo `GW` del JSON), vistos en los últimos 7 días: `[{device_uid, suggested_label, last_seen_at, gateway_name}]` |
| POST | `devices/` | "Vincular collar": `{device_uid, label?, ...}`. `device_uid` es el número del collar en cualquier formato (`84`, `084`, `C-084`, `COLLAR-84`) y se guarda como lo manda la Pi: `COLLAR-84`. Sin `label`, queda `C-084`. Si el collar ya transmitía sin dueño, se lo adopta con sus lecturas |
| PATCH | `devices/{id}/` | "Configurar": `label`, `tx_interval_s` (10–3600), `battery_model`, `storage_location`, ... |
| POST | `devices/{id}/assign/` | "Vincular a un animal": `{animal_id}` |
| POST | `devices/{id}/unassign/` | Desvincular: `{storage_location?}` |
| GET | `gateways/` | `[{id, gateway_uid, name, kind: gateway\|repeater, power_source, battery_pct, radio, coverage_ha, last_seen_at, lat, lng, online}]` |

### Administración (solo dueño para escribir)

| Método | Ruta | Devuelve |
|---|---|---|
| GET · PATCH | `organization/` | `{id, name, vet_phone, fever_threshold_c (37–42), no_signal_minutes (5–1440)}` |
| GET | `organization/members/` | `[{user_id, name, email, phone, role, active, access: {sections, all_yards, yard_ids, animal_ids}, created_at}]` (dueños primero) |
| PUT | `organization/members/{user_id}/access/` | `{sections: [...] (al menos una), all_yards, yard_ids?, animal_ids?}` → el miembro. Solo para rol `user` (a un dueño, 400). Con todas las secciones marcadas se guarda "todas", así incluye las que se agreguen después. |
| POST | `organization/members/` | `{name, email, password (ver Contraseñas), role: owner\|user, phone?}` → 201. Si el email ya tiene cuenta, se la suma sin cambiar su contraseña; si ya es miembro, 409. |
| PATCH | `organization/members/{user_id}/` | `{role?, active?}`. `active: false` suspende el acceso sin sacarlo (su `me/` deja de listar el establecimiento y el resto responde 403); `true` lo reactiva. No podés suspenderte a vos mismo ni dejar el establecimiento sin un dueño activo (409). |
| POST | `organization/members/{user_id}/password/` | `{new_password (ver Contraseñas)}` → 204. Solo dueño: le pone una contraseña nueva y cierra todas sus sesiones. La propia se cambia con `me/password/`. |
| DELETE | `organization/members/{user_id}/` | 204. Lo saca del establecimiento; la cuenta queda. |

### Raspberry Pi

| Método | Ruta | Para qué |
|---|---|---|
| POST | `telemetry/` | Una lectura o una lista. Sin login; si `TELEMETRY_API_KEY` está configurada, header `X-Api-Key`. Por TCP (`telemetry_tcp`, puerto 4001) la clave va dentro de cada JSON como `"KEY"` (en la Pi: `TELEMETRY_KEY`) |
| TCP | puerto `4001` | Lo mismo por TCP (servicio `telemetry`), para `lora_receiver.c` sin cambios: solo apuntar `BACKEND_IP` a esta PC. |

Payload que manda la Pi hoy: `{"ID":"COLLAR-3","LAT":-34.70,"LONG":-58.24,"TEMP":"38.40"}`.
Campos opcionales que ya se aceptan: `ACT`, `RUM`
(minutos de rumia desde la lectura anterior), `SPEED` (m/s), `HEADING`, `TS`
(hora de la medición), `GW` (id del gateway). Si no vienen velocidad y rumbo, se
calculan con la lectura anterior. `LAT`/`LONG` en 0 (GPS sin fix) se guarda sin posición.
Cualquier otro campo se ignora: `RSSI`/`SNR` (los agrega la Pi) y `BAT` no se guardan.

## Formatos

### Alerta

```json
{
  "id": 12, "type": "geofence_exit", "category": "critical", "severity": "critical",
  "status": "pending", "message": "Vaca #084 fuera del perímetro, a 297 m del límite.",
  "metadata": {"distance_m": 297, "lat": -34.25, "lng": -59.43},
  "triggered_at": "...", "resolved_at": null,
  "animal": {"id": 1, "name": "Vaca #084", "tag_number": "AR-039-994", "breed": "...", "lot": "...", "age_months": 40},
  "device": {"id": 1, "label": "C-084", "device_uid": "COLLAR-84", "last_seen_at": "..."},
  "yard": {"id": 1, "name": "Potrero 4 (Sur)"},
  "assigned_to": null, "resolved_by": null,
  "position": {"lat": -34.25, "lng": -59.43}, "speed_kmh": 1.0, "heading_label": "Este 90°"
}
```

- `type`: `geofence_exit`, `fever`, `low_activity`, `no_signal`
- `category`: `critical`, `sanitary`, `equipment`
- `status`: `pending` → `assigned` → `in_progress` → `resolved`

`PATCH alerts/{id}/` acepta `{"status": "...", "assigned_to": user_id}`. Si
asignás una alerta pendiente sin mandar `status`, pasa sola a `assigned`.

Reglas automáticas al llegar una lectura:
- Fuera del potrero → `geofence_exit`. Se resuelve sola cuando vuelve.
- Temperatura ≥ `fever_threshold_c` (39.2) → `fever`.
- Sin datos por más de 30 min → `no_signal`, que revisa el servicio `telemetry` cada minuto. Se resuelve sola al volver la señal.

### Animal

`{id, name, tag_number, lot, species, sex, breed, birth_date, age_months, photo_url, status, yard, geofence_status: inside|outside|unknown, distance_outside_m, health_status: optimal|alert, open_alerts, position: {lat, lng, recorded_at}, speed_kmh, heading_deg, heading_label, temp_body_c, device: {id, label, device_uid, last_seen_at, tx_interval_s, firmware_version}}`

### Collar

`{id, device_uid, label, state: optimal|alert|no_signal|stock, hardware_version, firmware_version, battery_model, tx_interval_s, last_seen_at, storage_location, geofence_alert_since, animal: {id, name, breed, lot, yard_name, geofence_status}}`

## Limitaciones actuales

- **Rumia y actividad:** el collar hoy no las manda. Los campos quedan en `null` hasta que el firmware las envíe (`RUM`, `ACT`).
- **Batería del collar y señal LoRa:** no se guardan (no hay columnas). Si el firmware empieza a mandar batería, hay que volver a agregarla en `db/schema.sql`, el trigger y el backend.
- **Ping forzado, alarma sonora y cambio de intervalo:** se guardan en `device_commands` con estado `queued`. Falta que la Pi pueda enviar mensajes al collar.
