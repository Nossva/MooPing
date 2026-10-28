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
| `frontend` | 5173 | App web: http://localhost:5173 (login demo con "Probar con Establecimiento Demo") |
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
- Collar C-114 con batería baja.
- Collar C-098 sin señal.
- 2 collares en stock.

Logins (contraseña `mooping123`):
- `demo@mooping.app`: **Dueño**. Edita todo y ve la sección Administración (usuarios y establecimiento).
- `maria@mooping.app`: **Usuario**. Ve todo, atiende alertas y recibe las alarmas, pero no edita.

Si tu base es de antes de un cambio de esquema, `python start.py` la actualiza sola. Con `docker compose up` directo, ver [db/README.md](db/README.md).

## Conectar la Raspberry Pi

En `firmware/AgroBot/firmware/lora_receiver.c`, cambiá `BACKEND_IP` por la IP
de la PC donde corre Docker (`BACKEND_PORT` queda en 4001). Cada paquete LoRa
queda guardado y genera alertas automáticamente. Para ver lo que llega:
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

## Puertos ocupados

Si ya tenés algo en el 5432, el 8000 o el 4001, creá un archivo `.env` en `mooping/`:

```
DB_PORT=5433
BACKEND_PORT=8001
TELEMETRY_PORT=4002
```

Datos de conexión desde tu PC (DBeaver, pgAdmin, etc.):
`postgres://mooping:mooping@localhost:5432/mooping`
