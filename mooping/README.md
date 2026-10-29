# MooPing

```
mooping/
├── docker-compose.yml   levanta todo: base de datos + backend + receptor de la Pi + frontend
├── db/                  schema.sql (PostgreSQL + PostGIS)
├── backend/             Django + DRF (traffic / services / repositories / entities)
│                        endpoints: backend/ENDPOINTS.md
└── frontend/            React + Vite (diseño de Figma), ver frontend/README.md
```

| Servicio | Puerto | Qué hace |
|---|---|---|
| `db` | 5432 | PostgreSQL + PostGIS |
| `backend` | 8000 | API REST (`/api/...`) |
| `frontend` | 5173 | App web: http://localhost:5173 |
| `telemetry` | 4001 | Recibe por TCP los JSON de la Raspberry Pi (`lora_receiver.c`) y revisa cada minuto los collares sin señal |

## Primera vez (y siempre)

Solo hace falta **Docker Desktop** abierto. No hace falta instalar Python ni crear el venv.

```bash
cd mooping
docker compose up -d --build
```

O, si tenés Python: `python start.py` hace lo mismo, actualiza la base existente con los `db/upgrade-*.sql`, espera a que respondan la API y el frontend y abre la app (http://localhost:5173).

La primera vez:
1. Descarga las imágenes y construye el backend (tarda unos minutos).
2. Crea la base `mooping` y ejecuta `db/schema.sql`.
3. Corre `python manage.py migrate` y arranca Django.

Probar: http://localhost:8000/api/health/ → `{"status":"ok","database":"ok"}`

## Datos de demo

```bash
docker compose exec backend python manage.py seed_demo          # primera vez
docker compose exec backend python manage.py seed_demo --reset  # volver a dejarla como nueva
```

Crea el establecimiento "El Ombú" con los mismos casos del Figma:
- 12 animales en 2 potreros, con 7 días de lecturas.
- Vaca #084 fuera del perímetro.
- Vaca #215 con fiebre.
- Collar C-098 sin señal.
- 2 collares en stock.

Logins (contraseña `mooping123`):
- `demo@mooping.app`: **Dueño**. Edita todo y ve la sección Administración (usuarios y establecimiento).
- `maria@mooping.app`: **Usuario**. Ve todo, atiende alertas y recibe las alarmas, pero no edita.

Si tu base es de antes de un cambio de esquema, `python start.py` la actualiza sola. Con `docker compose up` directo, ver [db/README.md](db/README.md).

## Conectar la Raspberry Pi

El receptor de la Pi (`firmware/AgroBot/firmware/lora_receiver.c`) reenvía cada
lectura por TCP a todos los destinos de `TELEMETRY_TARGETS`, así que AgroBot y MooPing
reciben lo mismo en paralelo, sin sincronizar bases. Para sumar MooPing, agregá la IP
de la PC donde corre Docker (puerto `TELEMETRY_PORT`, 4001 por defecto):

```bash
sudo TELEMETRY_TARGETS=127.0.0.1:4001,192.168.1.50:4001 GATEWAY_ID=AGROBOT-01 \
  ./build/agrobot-lora-receiver
```

- `127.0.0.1:4001` es el servidor AgroBot en la misma Pi; `192.168.1.50:4001`, MooPing.
  Si uno está apagado, el otro sigue recibiendo (cada envío corta a los 2 s).
- `GATEWAY_ID` tiene que coincidir con el `gateway_uid` del gateway en MooPing (el demo trae
  `AGROBOT-01` y `AGROBOT-02`): así figura "conectado" en Equipos y Soporte.
- Si AgroBot y MooPing corren en la misma máquina no pueden usar los dos el 4001: mové
  MooPing con `TELEMETRY_PORT` en `mooping/.env` y usá ese puerto en el destino.
- La PC tiene que aceptar conexiones entrantes en ese puerto (firewall).
- **Clave de telemetría**: si en `backend/.env` ponés `TELEMETRY_API_KEY=<clave>`, MooPing
  descarta toda lectura que no la traiga. En la Pi pasá la misma: `TELEMETRY_KEY=<clave>`.
  Sin clave, cualquiera en la red puede mandar posiciones falsas y disparar alertas.

Cada paquete queda guardado y genera alertas automáticamente. Para ver lo que llega:
`docker compose logs -f telemetry`.

## Comandos útiles

| Qué | Comando |
|---|---|
| Ver logs del backend | `docker compose logs -f backend` |
| Apagar todo | `docker compose down` |
| Reconstruir tras cambiar `requirements.txt` | `docker compose up -d --build` |
| Correr un comando de Django | `docker compose exec backend python manage.py <comando>` |
| Abrir la base (psql) | `docker compose exec db psql -U mooping -d mooping` |
| Borrar la base y recrearla desde `schema.sql` | `docker compose down -v` y después `docker compose up -d` |

Los cambios en el código del backend se recargan solos, sin reiniciar el contenedor.

## Soporte técnico (reclamos por email)

Los reclamos de la pestaña **Soporte** se guardan en la base (`support_requests`) y se
mandan por email a `SUPPORT_EMAIL` con el estado del sistema. "Responder" le escribe
directo al usuario. Configuralo en `backend/.env` y reiniciá (`docker compose restart backend telemetry`):

```
SUPPORT_EMAIL=soporte@ejemplo.com   # a quién llegan los reclamos

# SMTP para enviarlos (ej. Gmail con una "contraseña de aplicación")
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=tu-cuenta@gmail.com
EMAIL_HOST_PASSWORD=xxxx xxxx xxxx xxxx
DEFAULT_FROM_EMAIL=MooPing <tu-cuenta@gmail.com>

# Opcionales: "¿Es urgente?" debajo del formulario
SUPPORT_WHATSAPP=5491100000000      # código de país + número, sin + ni espacios
SUPPORT_PHONE=+54 9 11 0000-0000
SUPPORT_HOURS=Lun a vie de 8 a 18 h
```

Sin `EMAIL_HOST` el email se imprime en `docker compose logs backend` (útil para probar).
Si falta `SUPPORT_EMAIL` o el SMTP falla, el reclamo queda guardado igual y en "Mis
reclamos" figura como *Guardado* en vez de *Enviado*:

```bash
docker compose exec db psql -U mooping -d mooping -c "SELECT id, category, message, email_error FROM support_requests WHERE email_sent_at IS NULL"
```

## Seguridad y producción

`docker-compose.yml` es para desarrollo: DEBUG prendido, recarga automática, backend y Vite
abiertos a la red (para probar desde el celular). La base escucha **solo en esta PC**
(`127.0.0.1:5432`). Para instalarlo en un campo usá `docker-compose.prod.yml`:

```bash
cp .env.prod.example .env.prod      # completá SITE_HOST y las claves
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend python manage.py seed_demo  # opcional
```

- **HTTPS** con Caddy delante de todo. `CADDY_TLS=internal` usa un certificado propio (red
  local: el navegador avisa la primera vez); con un dominio público poné tu email y saca uno
  de Let's Encrypt.
- Desde la red solo quedan abiertos 80/443 (Caddy) y 4001 (telemetría, con clave obligatoria).
  La base y el backend quedan en la red interna de Docker.
- Backend con gunicorn y `DEBUG=false`. Arranca solo si `DJANGO_SECRET_KEY` es aleatoria y
  `SITE_HOST` es un host real (no `*`).
- Las claves viven en `.env.prod`, que está en `.gitignore`; las imágenes no copian ningún `.env`.

Sesión: cookie `HttpOnly` (JavaScript no la ve), las escrituras exigen el header
`X-Requested-With` (protección CSRF), contraseñas con PBKDF2 y tokens guardados como SHA-256.
Detalle en [backend/ENDPOINTS.md](backend/ENDPOINTS.md#autenticación).

## Puertos ocupados

Si ya tenés algo en el 5432, el 8000 o el 4001, creá un archivo `.env` en `mooping/`:

```
DB_PORT=5433
BACKEND_PORT=8001
TELEMETRY_PORT=4002
```

Datos de conexión desde tu PC (DBeaver, pgAdmin, etc.):
`postgres://mooping:mooping@localhost:5432/mooping`
